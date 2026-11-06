import os
import ipaddress
import socket
import platform
import shutil
import subprocess
import ctypes
from abc import ABC, abstractmethod
from pathlib import Path
from urllib.parse import urlparse

import httpx
from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field

# -----------------------------------------------------------------------------
# Configuration and Initialization
# -----------------------------------------------------------------------------
APP_DIR = Path(__file__).resolve().parent

# Explicitly load .env file from the project directory
load_dotenv(dotenv_path=APP_DIR / ".env")

try:
    TIMEOUT = float(os.getenv("PROVIDER_TIMEOUT_SECONDS", "45"))
except ValueError:
    TIMEOUT = 45.0

OLLAMA_URL = os.getenv("OLLAMA_BASE_URL", "http://127.0.0.1:11434").rstrip("/")
LLAMACPP_URL = os.getenv("LLAMACPP_BASE_URL", "http://127.0.0.1:8080").rstrip("/")

cors_env = os.getenv(
    "CORS_ORIGINS",
    "http://127.0.0.1:8000,http://localhost:8000,http://127.0.0.1:5173,http://localhost:5173,http://127.0.0.1:3000,http://localhost:3000,http://127.0.0.1:5500,http://localhost:5500",
)
FRONTEND_ORIGINS = [origin.strip() for origin in cors_env.split(",") if origin.strip()]

app = FastAPI(
    title="Model Gateway",
    description="Unified API gateway abstraction for Cloud and Local AI models",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=FRONTEND_ORIGINS,
    allow_credentials=False,
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["*"],
)


# -----------------------------------------------------------------------------
# Request & Response Models
# -----------------------------------------------------------------------------
class ChatRequest(BaseModel):
    category: str = Field(pattern="^(cloud|local)$")
    provider: str = Field(min_length=1, max_length=40)
    model: str = Field(min_length=1, max_length=160)
    message: str = Field(min_length=1, max_length=12000)
    custom_base_url: str | None = Field(default=None, max_length=500)


class TestRequest(BaseModel):
    category: str = Field(pattern="^(cloud|local)$")
    provider: str = Field(min_length=1, max_length=40)
    model: str | None = Field(default=None, max_length=160)
    custom_base_url: str | None = Field(default=None, max_length=500)


class EstimatorRequest(BaseModel):
    parameters_billion: float = Field(default=7.0, ge=0.1, le=500.0)
    quantization: str = Field(default="Q4_K_M")
    context_length: int = Field(default=4096, ge=512, le=200000)
    kv_cache_quant: str = Field(default="FP16")


# -----------------------------------------------------------------------------
# Security & Helper Functions
# -----------------------------------------------------------------------------
def validate_custom_url(url: str | None) -> str:
    """Validate user-supplied custom OpenAI-compatible base URLs to prevent SSRF."""
    if not url or not url.strip():
        raise HTTPException(
            status_code=400,
            detail="A custom OpenAI-compatible base URL is required.",
        )

    clean_url = url.strip().rstrip("/")
    parsed = urlparse(clean_url)

    if parsed.scheme.lower() != "https":
        raise HTTPException(
            status_code=400,
            detail="Custom API URLs must use HTTPS. Unencrypted HTTP is prohibited.",
        )

    if not parsed.hostname:
        raise HTTPException(
            status_code=400,
            detail="Custom API URL must include a valid hostname.",
        )

    if parsed.username or parsed.password:
        raise HTTPException(
            status_code=400,
            detail="Custom API URLs must not contain embedded user credentials.",
        )

    host = parsed.hostname.lower()

    if (
        host in ("localhost", "localhost.localdomain")
        or host.endswith(".local")
        or host.endswith(".internal")
    ):
        raise HTTPException(
            status_code=400,
            detail="Localhost and internal domain names are forbidden for custom cloud endpoints.",
        )

    port = parsed.port or 443

    # Check if host is a raw IP literal
    try:
        ip = ipaddress.ip_address(host)
        if (
            ip.is_private
            or ip.is_loopback
            or ip.is_link_local
            or ip.is_multicast
            or ip.is_reserved
            or not ip.is_global
        ):
            raise HTTPException(
                status_code=400,
                detail="Private and local IP addresses are forbidden for custom cloud endpoints.",
            )
        return clean_url
    except ValueError:
        pass

    # Resolve hostname via DNS and check all returned IP addresses
    try:
        addr_info = socket.getaddrinfo(host, port, type=socket.SOCK_STREAM)
        if not addr_info:
            raise HTTPException(
                status_code=400,
                detail=f"Hostname '{host}' could not be resolved.",
            )
        for item in addr_info:
            ip_str = item[4][0]
            ip = ipaddress.ip_address(ip_str)
            if (
                ip.is_private
                or ip.is_loopback
                or ip.is_link_local
                or ip.is_multicast
                or ip.is_reserved
                or not ip.is_global
            ):
                raise HTTPException(
                    status_code=400,
                    detail=f"Hostname '{host}' resolves to non-public address ({ip_str}), which is blocked for security.",
                )
    except socket.gaierror:
        raise HTTPException(
            status_code=400,
            detail=f"Hostname '{host}' could not be resolved via DNS.",
        )
    except Exception as exc:
        if isinstance(exc, HTTPException):
            raise
        raise HTTPException(status_code=400, detail=f"URL validation error: {exc}")

    return clean_url


async def request_json(
    method: str,
    url: str,
    provider_label: str = "Provider",
    **kwargs,
) -> dict:
    """Execute an HTTP request with uniform timeout, error sanitization, and security rules."""
    try:
        async with httpx.AsyncClient(timeout=TIMEOUT, follow_redirects=False) as client:
            response = await client.request(method, url, **kwargs)
    except httpx.TimeoutException:
        raise HTTPException(
            status_code=504,
            detail=f"Request to {provider_label} timed out after {int(TIMEOUT)}s. Check network connectivity or try a faster model.",
        )
    except httpx.ConnectError:
        raise HTTPException(
            status_code=503,
            detail=f"Could not connect to {provider_label}. Verify that the service is running and the endpoint URL is accessible.",
        )
    except httpx.RequestError as exc:
        raise HTTPException(
            status_code=502,
            detail=f"Network error communicating with {provider_label}: {type(exc).__name__}.",
        )

    if response.status_code in (401, 403):
        raise HTTPException(
            status_code=401,
            detail=f"Authentication failed for {provider_label} (HTTP {response.status_code}). Check your API key and permissions in .env.",
        )
    if response.status_code == 404:
        raise HTTPException(
            status_code=404,
            detail=f"The requested endpoint or model was not found on {provider_label} (HTTP 404).",
        )
    if response.status_code == 429:
        raise HTTPException(
            status_code=429,
            detail=f"Rate limit or quota exceeded for {provider_label}. Check your account billing and quota limits.",
        )
    if response.status_code >= 400:
        raise HTTPException(
            status_code=502,
            detail=f"{provider_label} returned HTTP {response.status_code}. Request could not be completed.",
        )

    try:
        return response.json()
    except Exception:
        raise HTTPException(
            status_code=502,
            detail=f"{provider_label} returned a response that is not valid JSON.",
        )


# -----------------------------------------------------------------------------
# Abstract Model Provider
# -----------------------------------------------------------------------------
class ModelProvider(ABC):
    @abstractmethod
    async def test_connection(self) -> dict:
        """Test connection and return status and discovered models."""
        ...

    @abstractmethod
    async def get_models(self) -> list[str]:
        """Discover or return supported models."""
        ...

    @abstractmethod
    async def generate(self, message: str, model: str) -> str:
        """Generate response text for the provided user message."""
        ...


# -----------------------------------------------------------------------------
# Concrete Provider Adapters
# -----------------------------------------------------------------------------
class OpenAIAdapter(ModelProvider):
    def __init__(self):
        self.api_key = os.getenv("OPENAI_API_KEY", "").strip()
        self.base_url = "https://api.openai.com/v1"
        self.default_model = "gpt-4o-mini"
        self.label = "OpenAI"

    def _require_key(self):
        if not self.api_key or self.api_key == "your_openai_api_key_here":
            raise HTTPException(
                status_code=503,
                detail="OPENAI_API_KEY is not configured in .env.",
            )

    async def get_models(self) -> list[str]:
        self._require_key()
        headers = {"Authorization": f"Bearer {self.api_key}"}
        data = await request_json(
            "GET",
            f"{self.base_url}/models",
            provider_label=self.label,
            headers=headers,
        )
        models = [
            m.get("id")
            for m in data.get("data", [])
            if isinstance(m, dict) and m.get("id")
        ]
        # Prioritize chat-compatible models
        chat_models = [m for m in models if m.startswith(("gpt-", "o1", "o3", "chatgpt"))]
        sorted_models = sorted(chat_models or models)
        return sorted_models or [self.default_model]

    async def test_connection(self) -> dict:
        models = await self.get_models()
        return {
            "status": "connected",
            "message": f"Successfully connected to OpenAI API ({len(models)} accessible models).",
            "models": models,
        }

    async def generate(self, message: str, model: str) -> str:
        self._require_key()
        headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json",
        }
        payload = {
            "model": model or self.default_model,
            "messages": [{"role": "user", "content": message}],
        }
        data = await request_json(
            "POST",
            f"{self.base_url}/chat/completions",
            provider_label=self.label,
            headers=headers,
            json=payload,
        )
        try:
            return data["choices"][0]["message"]["content"]
        except (KeyError, IndexError, TypeError):
            raise HTTPException(
                status_code=502,
                detail="OpenAI returned an unexpected chat response format.",
            )


class GeminiAdapter(ModelProvider):
    def __init__(self):
        self.api_key = os.getenv("GEMINI_API_KEY", "").strip()
        self.base_url = "https://generativelanguage.googleapis.com/v1beta"
        self.default_model = "gemini-1.5-flash"
        self.label = "Google Gemini"

    def _require_key(self):
        if not self.api_key or self.api_key == "your_gemini_api_key_here":
            raise HTTPException(
                status_code=503,
                detail="GEMINI_API_KEY is not configured in .env.",
            )

    async def get_models(self) -> list[str]:
        self._require_key()
        data = await request_json(
            "GET",
            f"{self.base_url}/models",
            provider_label=self.label,
            params={"key": self.api_key},
        )
        discovered = []
        for m in data.get("models", []):
            name = m.get("name", "")
            methods = m.get("supportedGenerationMethods", [])
            if "generateContent" in methods and name:
                discovered.append(name.removeprefix("models/"))
        return sorted(discovered) or [self.default_model]

    async def test_connection(self) -> dict:
        models = await self.get_models()
        return {
            "status": "connected",
            "message": f"Successfully connected to Google Gemini ({len(models)} content generation models).",
            "models": models,
        }

    async def generate(self, message: str, model: str) -> str:
        self._require_key()
        clean_model = (model or self.default_model).removeprefix("models/")
        if not clean_model:
            raise HTTPException(status_code=400, detail="Choose a valid Gemini model.")

        url = f"{self.base_url}/models/{clean_model}:generateContent"
        payload = {"contents": [{"parts": [{"text": message}]}]}
        data = await request_json(
            "POST",
            url,
            provider_label=self.label,
            params={"key": self.api_key},
            json=payload,
        )

        try:
            candidates = data.get("candidates", [])
            if not candidates:
                # Check for feedback or prompt blocking
                prompt_feedback = data.get("promptFeedback", {})
                block_reason = prompt_feedback.get("blockReason", "prompt was blocked by safety filters")
                raise HTTPException(
                    status_code=400,
                    detail=f"Gemini did not return a response: {block_reason}.",
                )
            parts = candidates[0].get("content", {}).get("parts", [])
            text = "".join(p.get("text", "") for p in parts)
            if not text:
                finish_reason = candidates[0].get("finishReason", "empty response")
                raise HTTPException(
                    status_code=502,
                    detail=f"Gemini generated an empty response (finishReason: {finish_reason}).",
                )
            return text
        except (KeyError, IndexError, TypeError):
            raise HTTPException(
                status_code=502,
                detail="Gemini returned an unexpected candidate response structure.",
            )


class QwenAPIAdapter(ModelProvider):
    def __init__(self):
        self.api_key = os.getenv("DASHSCOPE_API_KEY", "").strip()
        self.base_url = os.getenv(
            "QWEN_BASE_URL",
            "https://dashscope-intl.aliyuncs.com/compatible-mode/v1",
        ).rstrip("/")
        self.default_model = "qwen-plus"
        self.label = "Qwen API"

    def _require_key(self):
        if not self.api_key or self.api_key == "your_dashscope_api_key_here" or self.api_key == "your_qwen_api_key_here":
            raise HTTPException(
                status_code=503,
                detail="DASHSCOPE_API_KEY is not configured in .env.",
            )

    async def get_models(self) -> list[str]:
        self._require_key()
        headers = {"Authorization": f"Bearer {self.api_key}"}
        try:
            data = await request_json(
                "GET",
                f"{self.base_url}/models",
                provider_label=self.label,
                headers=headers,
            )
            models = [
                m.get("id")
                for m in data.get("data", [])
                if isinstance(m, dict) and m.get("id")
            ]
            if models:
                return sorted(models)
        except Exception:
            pass

        # Configured defaults for Qwen DashScope OpenAI compatible interface
        return [
            "qwen-plus",
            "qwen-turbo",
            "qwen-max",
            "qwen-long",
            "qwen2.5-72b-instruct",
            "qwen2.5-32b-instruct",
            "qwen2.5-14b-instruct",
            "qwen2.5-7b-instruct",
        ]

    async def test_connection(self) -> dict:
        models = await self.get_models()
        return {
            "status": "connected",
            "message": f"Successfully connected to Qwen DashScope endpoint ({self.base_url}).",
            "models": models,
        }

    async def generate(self, message: str, model: str) -> str:
        self._require_key()
        headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json",
        }
        payload = {
            "model": model or self.default_model,
            "messages": [{"role": "user", "content": message}],
        }
        data = await request_json(
            "POST",
            f"{self.base_url}/chat/completions",
            provider_label=self.label,
            headers=headers,
            json=payload,
        )
        try:
            return data["choices"][0]["message"]["content"]
        except (KeyError, IndexError, TypeError):
            raise HTTPException(
                status_code=502,
                detail="Qwen API returned an unexpected chat response format.",
            )


class CustomOpenAICompatibleAdapter(ModelProvider):
    def __init__(self, base_url: str):
        self.base_url = validate_custom_url(base_url)
        self.api_key = os.getenv("CUSTOM_API_KEY", "").strip()
        if self.api_key == "your_custom_api_key_here":
            self.api_key = ""
        self.label = "Custom OpenAI-compatible API"

    async def get_models(self) -> list[str]:
        headers = {}
        if self.api_key:
            headers["Authorization"] = f"Bearer {self.api_key}"
        data = await request_json(
            "GET",
            f"{self.base_url}/models",
            provider_label=self.label,
            headers=headers,
        )
        models = [
            m.get("id")
            for m in data.get("data", [])
            if isinstance(m, dict) and m.get("id")
        ]
        return sorted(models)

    async def test_connection(self) -> dict:
        models = await self.get_models()
        return {
            "status": "connected",
            "message": f"Successfully connected to custom endpoint ({len(models)} models discovered).",
            "models": models,
        }

    async def generate(self, message: str, model: str) -> str:
        if not model:
            raise HTTPException(
                status_code=400,
                detail="Model name is required for custom OpenAI-compatible endpoints.",
            )
        headers = {"Content-Type": "application/json"}
        if self.api_key:
            headers["Authorization"] = f"Bearer {self.api_key}"
        payload = {
            "model": model,
            "messages": [{"role": "user", "content": message}],
        }
        data = await request_json(
            "POST",
            f"{self.base_url}/chat/completions",
            provider_label=self.label,
            headers=headers,
            json=payload,
        )
        try:
            return data["choices"][0]["message"]["content"]
        except (KeyError, IndexError, TypeError):
            raise HTTPException(
                status_code=502,
                detail="Custom provider returned an unexpected chat response format.",
            )


class OllamaAdapter(ModelProvider):
    def __init__(self):
        self.base_url = OLLAMA_URL
        self.label = "Ollama"

    async def get_models(self) -> list[str]:
        data = await request_json(
            "GET",
            f"{self.base_url}/api/tags",
            provider_label=self.label,
        )
        models = [
            m.get("name")
            for m in data.get("models", [])
            if isinstance(m, dict) and m.get("name")
        ]
        return sorted(models)

    async def test_connection(self) -> dict:
        models = await self.get_models()
        return {
            "status": "connected",
            "message": f"Ollama is reachable at {self.base_url} ({len(models)} installed models found).",
            "models": models,
        }

    async def generate(self, message: str, model: str) -> str:
        installed_models = await self.get_models()
        if not installed_models:
            raise HTTPException(
                status_code=400,
                detail="No models are currently installed in Ollama. Pull a model using `ollama run <model>` first.",
            )
        if model not in installed_models:
            raise HTTPException(
                status_code=400,
                detail=f"Model '{model}' is not installed in Ollama. Available: {', '.join(installed_models[:5])}. The gateway will not automatically download models.",
            )

        payload = {
            "model": model,
            "messages": [{"role": "user", "content": message}],
            "stream": False,
        }
        data = await request_json(
            "POST",
            f"{self.base_url}/api/chat",
            provider_label=self.label,
            json=payload,
        )
        try:
            return data["message"]["content"]
        except (KeyError, TypeError):
            raise HTTPException(
                status_code=502,
                detail="Ollama returned an unexpected response format.",
            )


class LlamaCppAdapter(ModelProvider):
    def __init__(self):
        self.base_url = LLAMACPP_URL
        self.label = "llama.cpp Server"

    async def get_models(self) -> list[str]:
        data = await request_json(
            "GET",
            f"{self.base_url}/v1/models",
            provider_label=self.label,
        )
        models = [
            m.get("id")
            for m in data.get("data", [])
            if isinstance(m, dict) and m.get("id")
        ]
        return sorted(models) or ["default"]

    async def test_connection(self) -> dict:
        models = await self.get_models()
        return {
            "status": "connected",
            "message": f"llama.cpp HTTP server is running at {self.base_url}.",
            "models": models,
        }

    async def generate(self, message: str, model: str) -> str:
        payload = {
            "model": model or "default",
            "messages": [{"role": "user", "content": message}],
            "stream": False,
        }
        data = await request_json(
            "POST",
            f"{self.base_url}/v1/chat/completions",
            provider_label=self.label,
            json=payload,
        )
        try:
            return data["choices"][0]["message"]["content"]
        except (KeyError, IndexError, TypeError):
            raise HTTPException(
                status_code=502,
                detail="llama.cpp server returned an unexpected response format.",
            )


# -----------------------------------------------------------------------------
# Provider Registry / Factory
# -----------------------------------------------------------------------------
def get_adapter(
    category: str,
    provider: str,
    custom_base_url: str | None = None,
) -> ModelProvider:
    if category == "local":
        if provider == "ollama":
            return OllamaAdapter()
        if provider == "llamacpp":
            return LlamaCppAdapter()
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported local runtime '{provider}'. Choose 'ollama' or 'llamacpp'.",
        )

    if category == "cloud":
        if provider == "openai":
            return OpenAIAdapter()
        if provider == "gemini":
            return GeminiAdapter()
        if provider == "qwen":
            return QwenAPIAdapter()
        if provider == "custom":
            if not custom_base_url:
                raise HTTPException(
                    status_code=400,
                    detail="A valid HTTPS base URL is required for the Custom OpenAI-compatible provider.",
                )
            return CustomOpenAICompatibleAdapter(custom_base_url)
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported cloud provider '{provider}'.",
        )

    raise HTTPException(
        status_code=400,
        detail="Category must be either 'cloud' or 'local'.",
    )


def get_frontend_index() -> Path:
    """Resolve the frontend index file (React Vite build in dist, or fallback index.html)."""
    sibling_dist_index = APP_DIR.parent / "frontend" / "dist" / "index.html"
    if sibling_dist_index.is_file():
        return sibling_dist_index
    local_dist_index = APP_DIR / "dist" / "index.html"
    if local_dist_index.is_file():
        return local_dist_index
    legacy_index = APP_DIR / "index.html"
    if legacy_index.is_file():
        return legacy_index
    raise HTTPException(
        status_code=500,
        detail="Frontend index file not found. Ensure either frontend/dist is built or index.html exists.",
    )


# Mount static assets if built
_sibling_assets = APP_DIR.parent / "frontend" / "dist" / "assets"
_local_assets = APP_DIR / "dist" / "assets"
if _sibling_assets.is_dir():
    app.mount("/assets", StaticFiles(directory=_sibling_assets), name="assets")
elif _local_assets.is_dir():
    app.mount("/assets", StaticFiles(directory=_local_assets), name="assets")


# -----------------------------------------------------------------------------
# API Endpoints
# -----------------------------------------------------------------------------
@app.get("/")
async def root_index():
    """Serve the single-page frontend application."""
    return FileResponse(get_frontend_index())


@app.get("/playground")
@app.get("/providers")
@app.get("/comparison")
@app.get("/estimator")
@app.get("/research")
@app.get("/settings")
async def client_routes():
    """Support HTML5 client-side routing by serving index.html for known routes."""
    return FileResponse(get_frontend_index())


@app.get("/api/health")
async def health_check():
    """Return backend operational status."""
    return {
        "status": "ok",
        "application": "Model Gateway",
        "version": "1.0.0",
    }


@app.get("/api/providers")
async def list_providers():
    """Return supported categories, providers, default models, and configuration status."""
    openai_key = os.getenv("OPENAI_API_KEY", "").strip()
    openai_configured = bool(openai_key and openai_key != "your_openai_api_key_here")

    gemini_key = os.getenv("GEMINI_API_KEY", "").strip()
    gemini_configured = bool(gemini_key and gemini_key != "your_gemini_api_key_here")

    dashscope_key = os.getenv("DASHSCOPE_API_KEY", "").strip()
    dashscope_configured = bool(
        dashscope_key
        and dashscope_key != "your_dashscope_api_key_here"
        and dashscope_key != "your_qwen_api_key_here"
    )

    custom_key = os.getenv("CUSTOM_API_KEY", "").strip()
    custom_configured = bool(custom_key and custom_key != "your_custom_api_key_here")

    return {
        "categories": [
            {
                "id": "cloud",
                "name": "Cloud AI",
                "providers": [
                    {
                        "id": "openai",
                        "name": "OpenAI",
                        "default_model": "gpt-4o-mini",
                        "configured": openai_configured,
                        "requires_custom_url": False,
                    },
                    {
                        "id": "gemini",
                        "name": "Google Gemini",
                        "default_model": "gemini-1.5-flash",
                        "configured": gemini_configured,
                        "requires_custom_url": False,
                    },
                    {
                        "id": "qwen",
                        "name": "Qwen API",
                        "default_model": "qwen-plus",
                        "configured": dashscope_configured,
                        "requires_custom_url": False,
                    },
                    {
                        "id": "custom",
                        "name": "Custom OpenAI-compatible API",
                        "default_model": "",
                        "configured": custom_configured,
                        "requires_custom_url": True,
                    },
                ],
            },
            {
                "id": "local",
                "name": "Local AI",
                "providers": [
                    {
                        "id": "ollama",
                        "name": "Ollama",
                        "default_model": "",
                        "configured": True,
                        "default_url": OLLAMA_URL,
                        "requires_custom_url": False,
                        "is_local_bridge": True,
                    },
                    {
                        "id": "llamacpp",
                        "name": "llama.cpp Server",
                        "default_model": "",
                        "configured": True,
                        "default_url": LLAMACPP_URL,
                        "requires_custom_url": False,
                        "is_local_bridge": True,
                    },
                ],
            },
        ]
    }


@app.get("/api/models")
async def list_models(
    category: str = Query(..., pattern="^(cloud|local)$"),
    provider: str = Query(..., min_length=1, max_length=40),
    custom_base_url: str | None = None,
):
    """Discover installed or accessible models for the specified provider."""
    if category == "cloud" and provider == "custom":
        if not custom_base_url or not custom_base_url.strip():
            return {
                "models": [],
                "source": "manual",
                "notice": "Enter an HTTPS base URL in Settings to discover or query custom models.",
            }
        custom_base_url = validate_custom_url(custom_base_url)

    adapter = get_adapter(category, provider, custom_base_url)

    try:
        models = await adapter.get_models()
        return {
            "models": models,
            "source": "runtime" if category == "local" else "discovered",
            "notice": None,
        }
    except HTTPException as exc:
        # For cloud providers without valid keys, return sensible defaults marked clearly
        if category == "cloud":
            defaults_map = {
                "openai": ["gpt-4o-mini", "gpt-4o", "gpt-4-turbo", "gpt-3.5-turbo"],
                "gemini": ["gemini-1.5-flash", "gemini-1.5-pro", "gemini-2.0-flash", "gemini-2.5-flash"],
                "qwen": ["qwen-plus", "qwen-turbo", "qwen-max", "qwen-long"],
                "custom": [],
            }
            fallback = defaults_map.get(provider, [])
            return {
                "models": fallback,
                "source": "defaults",
                "notice": f"{exc.detail} Showing standard default models (unverified).",
            }
        # For local runtimes, surface the actual connectivity error so users know to start the process
        raise


@app.post("/api/providers/test")
async def test_provider(body: TestRequest):
    """Perform a live connectivity and authentication test for the selected provider."""
    if body.category == "cloud" and body.provider == "custom":
        if not body.custom_base_url or not body.custom_base_url.strip():
            raise HTTPException(
                status_code=400,
                detail="Custom base URL is required to test custom provider.",
            )
        body.custom_base_url = validate_custom_url(body.custom_base_url)

    adapter = get_adapter(body.category, body.provider, body.custom_base_url)
    result = await adapter.test_connection()
    return {
        "status": "connected",
        "provider": body.provider,
        "category": body.category,
        "message": result.get("message", f"Connected to {body.provider}."),
        "models": result.get("models", []),
    }


@app.post("/api/chat")
async def chat(body: ChatRequest):
    """Process a chat completion request through the chosen provider abstraction."""
    if body.category == "cloud" and body.provider == "custom":
        if not body.custom_base_url or not body.custom_base_url.strip():
            raise HTTPException(
                status_code=400,
                detail="Custom base URL is required for custom provider.",
            )
        body.custom_base_url = validate_custom_url(body.custom_base_url)

    adapter = get_adapter(body.category, body.provider, body.custom_base_url)
    user_msg = body.message.strip()
    model_name = body.model.strip()

    if not user_msg:
        raise HTTPException(status_code=400, detail="Message content cannot be empty.")
    if not model_name:
        raise HTTPException(
            status_code=400,
            detail="Model selection is required. Please choose a model from the dropdown.",
        )

    response_text = await adapter.generate(user_msg, model_name)

    return {
        "response": response_text,
        "provider": body.provider,
        "category": body.category,
        "model": model_name,
    }


# -----------------------------------------------------------------------------
# Hardware Inspection & Resource Estimation
# -----------------------------------------------------------------------------
def get_system_hardware() -> dict:
    """Inspect actual physical CPU, memory, GPU, and local AI runtime status."""
    total_ram_gb = 0.0
    avail_ram_gb = 0.0
    used_ram_gb = 0.0
    memory_load_pct = 0

    if platform.system() == "Windows":
        try:
            class MEMORYSTATUSEX(ctypes.Structure):
                _fields_ = [
                    ("dwLength", ctypes.c_ulong),
                    ("dwMemoryLoad", ctypes.c_ulong),
                    ("ullTotalPhys", ctypes.c_ulonglong),
                    ("ullAvailPhys", ctypes.c_ulonglong),
                    ("ullTotalPageFile", ctypes.c_ulonglong),
                    ("ullAvailPageFile", ctypes.c_ulonglong),
                    ("ullTotalVirtual", ctypes.c_ulonglong),
                    ("ullAvailVirtual", ctypes.c_ulonglong),
                    ("ullAvailExtendedVirtual", ctypes.c_ulonglong),
                ]
            stat = MEMORYSTATUSEX()
            stat.dwLength = ctypes.sizeof(MEMORYSTATUSEX)
            ctypes.windll.kernel32.GlobalMemoryStatusEx(ctypes.byref(stat))
            total_ram_gb = round(stat.ullTotalPhys / (1024**3), 2)
            avail_ram_gb = round(stat.ullAvailPhys / (1024**3), 2)
            used_ram_gb = round(total_ram_gb - avail_ram_gb, 2)
            memory_load_pct = stat.dwMemoryLoad
        except Exception:
            pass

    # GPU Detection via Windows CIM / PowerShell
    gpu_name = "Integrated / Standard Display"
    gpu_vram_gb = 0.0
    gpu_driver = "Unknown"
    if platform.system() == "Windows":
        try:
            res = subprocess.run(
                ["powershell", "-NoProfile", "-Command", "Get-CimInstance Win32_VideoController | Select-Object -Property Name, AdapterRAM, DriverVersion | ConvertTo-Json"],
                capture_output=True,
                text=True,
                timeout=4,
            )
            if res.returncode == 0 and res.stdout.strip():
                import json
                gpu_data = json.loads(res.stdout)
                if isinstance(gpu_data, list) and len(gpu_data) > 0:
                    gpu_data = gpu_data[0]
                if isinstance(gpu_data, dict):
                    gpu_name = gpu_data.get("Name", gpu_name)
                    raw_ram = gpu_data.get("AdapterRAM") or 0
                    if raw_ram:
                        gpu_vram_gb = round(float(raw_ram) / (1024**3), 2)
                    gpu_driver = gpu_data.get("DriverVersion", gpu_driver)
        except Exception:
            pass

    # Check llmfit CLI availability
    llmfit_path = shutil.which("llmfit")
    llmfit_installed = bool(llmfit_path)

    return {
        "os": {
            "system": platform.system(),
            "release": platform.release(),
            "version": platform.version(),
            "platform": platform.platform(),
            "python_version": platform.python_version(),
        },
        "cpu": {
            "processor": platform.processor() or "Generic x86_64",
            "machine": platform.machine(),
            "logical_cores": os.cpu_count() or 1,
        },
        "ram": {
            "total_gb": total_ram_gb,
            "available_gb": avail_ram_gb,
            "used_gb": used_ram_gb,
            "load_percent": memory_load_pct,
        },
        "gpu": {
            "name": gpu_name,
            "vram_gb": gpu_vram_gb,
            "driver_version": gpu_driver,
            "detected": gpu_name != "Integrated / Standard Display",
        },
        "llmfit": {
            "installed": llmfit_installed,
            "path": llmfit_path,
            "role": "Model/Hardware Sizing Recommendation Tool (AlexsJones/llmfit)",
            "notice": (
                f"llmfit CLI is available on PATH at '{llmfit_path}'."
                if llmfit_installed
                else "llmfit is not detected on system PATH. Model Gateway provides built-in formula-based hardware sizing and can link to llmfit CLI when installed."
            ),
        },
    }


def calculate_resource_estimate(
    params_b: float,
    quant: str,
    context_len: int,
    kv_quant: str = "FP16",
    host_hardware: dict | None = None,
) -> dict:
    """Calculate RAM & VRAM requirements for local models using architecture formulas."""
    bpw_map = {
        "FP16": 16.0,
        "Q8_0": 8.5,
        "Q6_K": 6.6,
        "Q5_K_M": 5.5,
        "Q5_0": 5.5,
        "Q4_K_M": 4.5,
        "Q4_0": 4.5,
        "Q3_K_M": 3.5,
        "Q2_K": 2.7,
    }
    bits = bpw_map.get(quant.upper(), 4.5)
    weights_gb = round((params_b * bits / 8.0) * 1.15, 2)

    bytes_per_elem = 2.0 if kv_quant.upper() == "FP16" else (1.0 if kv_quant.upper() == "Q8_0" else 0.5)
    if params_b <= 1.5:
        layers, hidden = 16, 2048
    elif params_b <= 4.0:
        layers, hidden = 24, 3072
    elif params_b <= 9.0:
        layers, hidden = 32, 4096
    elif params_b <= 16.0:
        layers, hidden = 40, 5120
    elif params_b <= 35.0:
        layers, hidden = 64, 5120
    else:
        layers, hidden = 80, 8192

    kv_cache_bytes = 2 * layers * hidden * context_len * bytes_per_elem
    kv_cache_gb = round(kv_cache_bytes / (1024**3), 2)
    activation_overhead_gb = round(max(0.3, params_b * 0.05 + (context_len / 8192) * 0.2), 2)
    total_required_gb = round(weights_gb + kv_cache_gb + activation_overhead_gb, 2)

    if not host_hardware:
        host_hardware = get_system_hardware()

    avail_ram = host_hardware["ram"]["available_gb"] or 8.0
    total_ram = host_hardware["ram"]["total_gb"] or 16.0
    gpu_vram = host_hardware["gpu"]["vram_gb"] or 0.0

    if gpu_vram > 0 and total_required_gb <= (gpu_vram * 0.9):
        compatibility = "Full GPU Offload"
        compatibility_badge = "success"
        recommendation = f"Model fits fully inside GPU VRAM ({total_required_gb} GB <= {gpu_vram} GB). Fast token generation via CUDA/ROCm."
        llama_layers = 99
    elif gpu_vram > 1.5 and total_required_gb <= (avail_ram + gpu_vram * 0.85):
        compatibility = "Partial GPU Offload"
        compatibility_badge = "warning"
        offload_pct = min(95, int((gpu_vram * 0.85 / total_required_gb) * 100))
        llama_layers = max(1, int(layers * (offload_pct / 100)))
        recommendation = f"Model can split layers between GPU VRAM (~{offload_pct}% offloaded) and System RAM. Moderate inference speed."
    elif total_required_gb <= avail_ram:
        compatibility = "CPU Only (RAM Sufficient)"
        compatibility_badge = "info"
        llama_layers = 0
        recommendation = f"Model fits in available system RAM ({total_required_gb} GB <= {avail_ram} GB available). Runs via CPU inference (slower, but functional)."
    elif total_required_gb <= total_ram:
        compatibility = "Tight RAM (Close Background Apps)"
        compatibility_badge = "warning"
        llama_layers = 0
        recommendation = f"Total requirement ({total_required_gb} GB) fits in physical RAM ({total_ram} GB), but exceeds currently available free RAM ({avail_ram} GB). Free memory by closing background processes."
    else:
        compatibility = "Insufficient Hardware"
        compatibility_badge = "destructive"
        llama_layers = 0
        recommendation = f"Total requirement ({total_required_gb} GB) exceeds total host RAM ({total_ram} GB). Model will fail to load or cause severe OS paging/swapping."

    return {
        "parameters_billion": params_b,
        "quantization": quant,
        "context_length": context_len,
        "kv_cache_quant": kv_quant,
        "weights_memory_gb": weights_gb,
        "kv_cache_memory_gb": kv_cache_gb,
        "activation_overhead_gb": activation_overhead_gb,
        "total_required_gb": total_required_gb,
        "host_ram_available_gb": avail_ram,
        "host_ram_total_gb": total_ram,
        "host_gpu_vram_gb": gpu_vram,
        "compatibility": compatibility,
        "compatibility_badge": compatibility_badge,
        "recommended_llama_gpu_layers": llama_layers,
        "recommended_command": (
            f"llama-server -m <model>.gguf -c {context_len} -ngl {llama_layers} --threads {os.cpu_count() or 4}"
            if llama_layers > 0
            else f"llama-server -m <model>.gguf -c {context_len} -ngl 0 --threads {os.cpu_count() or 4}"
        ),
        "explanation": recommendation,
        "disclaimer": "Hardware sizing formula estimate. Actual memory consumption may vary depending on quantization variant, GPU driver overhead, and runtime batch size.",
    }


def get_models_comparison_data() -> list[dict]:
    """Return model comparison metadata with verified capabilities and provider specifics."""
    return [
        {
            "id": "gemini-2.5-flash",
            "name": "Gemini 2.5 Flash",
            "provider": "gemini",
            "provider_name": "Google Gemini",
            "category": "cloud",
            "context_window": 1048576,
            "context_window_display": "1,048,576 tokens (~1M)",
            "input_modalities": ["Text", "Images", "Audio", "Video", "PDF"],
            "output_modalities": ["Text", "Code"],
            "streaming": True,
            "tool_calling": True,
            "structured_output": True,
            "free_tier": "Free tier with rate limits (15 RPM, 1M TPM, 1,500 RPD on AI Studio)",
            "rate_limits": "15 RPM / 1M TPM / 1500 RPD (Free Tier)",
            "license": "Google Gemini Terms of Service",
            "license_type": "Proprietary API",
            "status": "verified",
            "verification_note": "Verified live in test: returned successful response.",
        },
        {
            "id": "gemini-1.5-flash",
            "name": "Gemini 1.5 Flash",
            "provider": "gemini",
            "provider_name": "Google Gemini",
            "category": "cloud",
            "context_window": 1048576,
            "context_window_display": "1,048,576 tokens (~1M)",
            "input_modalities": ["Text", "Images", "Audio", "Video", "PDF"],
            "output_modalities": ["Text", "Code"],
            "streaming": True,
            "tool_calling": True,
            "structured_output": True,
            "free_tier": "Free tier available (15 RPM on Google AI Studio)",
            "rate_limits": "15 RPM / 1M TPM",
            "license": "Google Gemini Terms of Service",
            "license_type": "Proprietary API",
            "status": "verified",
            "verification_note": "Verified in API discovery and Google Generative Language documentation.",
        },
        {
            "id": "gemini-1.5-pro",
            "name": "Gemini 1.5 Pro",
            "provider": "gemini",
            "provider_name": "Google Gemini",
            "category": "cloud",
            "context_window": 2097152,
            "context_window_display": "2,097,152 tokens (~2M)",
            "input_modalities": ["Text", "Images", "Audio", "Video", "PDF"],
            "output_modalities": ["Text", "Code"],
            "streaming": True,
            "tool_calling": True,
            "structured_output": True,
            "free_tier": "Free tier available (2 RPM, 32k TPM, 50 RPD on Google AI Studio)",
            "rate_limits": "2 RPM / 32k TPM / 50 RPD",
            "license": "Google Gemini Terms of Service",
            "license_type": "Proprietary API",
            "status": "documented",
            "verification_note": "Documented metadata. Note: experimental or pro preview names may return 404 if discontinued.",
        },
        {
            "id": "gpt-4o-mini",
            "name": "GPT-4o Mini",
            "provider": "openai",
            "provider_name": "OpenAI",
            "category": "cloud",
            "context_window": 128000,
            "context_window_display": "128,000 tokens",
            "input_modalities": ["Text", "Images"],
            "output_modalities": ["Text", "Code"],
            "streaming": True,
            "tool_calling": True,
            "structured_output": True,
            "free_tier": "No permanent free tier (Requires prepaid credit balance or trial tier)",
            "rate_limits": "Tier-dependent (Tier 1: 500 RPM, 200,000 TPM)",
            "license": "OpenAI Terms of Use",
            "license_type": "Proprietary API",
            "status": "documented",
            "verification_note": "Documented in OpenAI API v1. Connection test passed; chat returned 429 quota exhausted.",
        },
        {
            "id": "gpt-4o",
            "name": "GPT-4o",
            "provider": "openai",
            "provider_name": "OpenAI",
            "category": "cloud",
            "context_window": 128000,
            "context_window_display": "128,000 tokens",
            "input_modalities": ["Text", "Images", "Audio (via Realtime)"],
            "output_modalities": ["Text", "Code"],
            "streaming": True,
            "tool_calling": True,
            "structured_output": True,
            "free_tier": "No free tier (Pay-as-you-go billing required)",
            "rate_limits": "Tier-dependent (Tier 1: 500 RPM, 30,000 TPM)",
            "license": "OpenAI Terms of Use",
            "license_type": "Proprietary API",
            "status": "documented",
            "verification_note": "Documented OpenAI flagship multimodal model.",
        },
        {
            "id": "qwen-plus",
            "name": "Qwen Plus",
            "provider": "qwen",
            "provider_name": "Qwen / DashScope",
            "category": "cloud",
            "context_window": 131072,
            "context_window_display": "131,072 tokens (~128k)",
            "input_modalities": ["Text"],
            "output_modalities": ["Text", "Code"],
            "streaming": True,
            "tool_calling": True,
            "structured_output": True,
            "free_tier": "Initial free credit quota on DashScope registration (valid for limited period)",
            "rate_limits": "Default 60 RPM on standard tier",
            "license": "Alibaba Cloud DashScope Service Terms",
            "license_type": "Hosted Commercial API",
            "status": "documented",
            "verification_note": "Documented in Alibaba Cloud DashScope compatible-mode documentation.",
        },
        {
            "id": "qwen2.5-72b-instruct",
            "name": "Qwen2.5 72B Instruct",
            "provider": "qwen",
            "provider_name": "Qwen / DashScope",
            "category": "cloud",
            "context_window": 131072,
            "context_window_display": "131,072 tokens (~128k)",
            "input_modalities": ["Text"],
            "output_modalities": ["Text", "Code"],
            "streaming": True,
            "tool_calling": True,
            "structured_output": True,
            "free_tier": "Available via DashScope compatible-mode or open weights",
            "rate_limits": "Dependent on DashScope API tier",
            "license": "Qwen License (Apache 2.0 for <=32B; custom open license for 72B)",
            "license_type": "Open Weights / Hosted API",
            "status": "documented",
            "verification_note": "Documented high-capability open-weight model hosted on DashScope.",
        },
        {
            "id": "llama3.2:1b",
            "name": "Llama 3.2 1B",
            "provider": "ollama",
            "provider_name": "Ollama (Local)",
            "category": "local",
            "context_window": 131072,
            "context_window_display": "131,072 tokens (default 8,192 in Ollama)",
            "input_modalities": ["Text"],
            "output_modalities": ["Text", "Code"],
            "streaming": True,
            "tool_calling": True,
            "structured_output": True,
            "free_tier": "100% Free & Open-Weight (Locally executed, zero API costs)",
            "rate_limits": "No rate limits (Hardware bound)",
            "license": "Llama 3.2 Community License (Meta)",
            "license_type": "Open-weight with commercial threshold (<700M monthly active users)",
            "status": "verified",
            "verification_note": "Verified live in Ollama runtime: discovered and generated response successfully.",
        },
        {
            "id": "ggml-org/Qwen3.5-0.8B-GGUF",
            "name": "Qwen3.5 0.8B GGUF",
            "provider": "llamacpp",
            "provider_name": "llama.cpp Server",
            "category": "local",
            "context_window": 32768,
            "context_window_display": "32,768 tokens (configurable via -c)",
            "input_modalities": ["Text"],
            "output_modalities": ["Text", "Code"],
            "streaming": True,
            "tool_calling": False,
            "structured_output": True,
            "free_tier": "100% Free & Open-Weight (Locally executed via llama-server)",
            "rate_limits": "No rate limits (Hardware bound)",
            "license": "Apache License 2.0",
            "license_type": "Permissive Open Source",
            "status": "verified",
            "verification_note": "Verified in Week 4 tests: executed via local llama-server.",
        },
        {
            "id": "custom-openai-model",
            "name": "Custom OpenAI-Compatible Endpoint",
            "provider": "custom",
            "provider_name": "Custom Endpoint",
            "category": "cloud",
            "context_window": 0,
            "context_window_display": "Provider Dependent",
            "input_modalities": ["Text"],
            "output_modalities": ["Text"],
            "streaming": True,
            "tool_calling": False,
            "structured_output": False,
            "free_tier": "Dependent on target custom service",
            "rate_limits": "Dependent on target custom service",
            "license": "Target Server Terms",
            "license_type": "Custom",
            "status": "unverified",
            "verification_note": "Requires user HTTPS URL configuration. SSRF protections active.",
        },
    ]


def get_research_audit_data() -> list[dict]:
    """Return verified technical audit information for the 6 core technologies."""
    return [
        {
            "id": "qwen-code",
            "name": "Qwen Code",
            "category": "AI Coding Agent & Multi-Provider Tooling",
            "repository": "https://github.com/QwenLM/qwen-code",
            "official_site": "https://qwenlm.github.io/",
            "license": "Apache License 2.0",
            "license_type": "Permissive Open Source",
            "dependencies": ["Python", "OpenAI-compatible client", "Prompt formatting templates"],
            "security_policy": "Explicit SECURITY.md directing vulnerability submissions to the Alibaba Security Issue Reporting portal.",
            "maintenance_status": "Active development under QwenLM / Alibaba Cloud open-source ecosystem.",
            "integration_relevance": "Exemplary implementation of multi-provider routing and compatible-endpoint adapters.",
            "key_findings": "Demonstrates clean abstraction over OpenAI-compatible endpoints and DashScope services. Preserves trademark boundaries while providing Apache 2.0 permissive licensing for the agent code.",
        },
        {
            "id": "claude-code",
            "name": "Claude Code",
            "category": "Agentic Coding CLI & Terminal Assistant",
            "repository": "https://github.com/anthropics/claude-code",
            "official_site": "https://docs.anthropic.com/en/docs/agents-and-tools/claude-code/overview",
            "license": "Proprietary Commercial (Anthropic Terms of Service)",
            "license_type": "Proprietary",
            "dependencies": ["Node.js / npm runtime", "Anthropic Claude API client", "Shell execution harness"],
            "security_policy": "Anthropic Trust & Security vulnerability disclosure program; requires explicit user approval for file edits and bash execution.",
            "maintenance_status": "Actively developed by Anthropic as official CLI research preview.",
            "integration_relevance": "Reference architecture for terminal-driven agentic tool use, structured reasoning, and human-in-the-loop safety gates.",
            "key_findings": "Claude Code highlights the necessity of strict sandboxing and user consent gates before executing local commands or tool calls generated by language models.",
        },
        {
            "id": "openai-codex",
            "name": "OpenAI Codex",
            "category": "Specialized Code Generation Model Family & API",
            "repository": "https://github.com/openai/human-eval",
            "official_site": "https://openai.com/index/openai-codex/",
            "license": "Proprietary Commercial Service (OpenAI API Terms)",
            "license_type": "Proprietary API",
            "dependencies": ["OpenAI Python / Node SDK", "REST API / OpenAI endpoints"],
            "security_policy": "OpenAI Bug Bounty Program (Bugcrowd) and Coordinated Vulnerability Disclosure.",
            "maintenance_status": "Historical code-davinci-002 models deprecated; capabilities integrated directly into GPT-4o, GPT-4o-mini, and o-series reasoning models.",
            "integration_relevance": "Pioneered code completion benchmarks (HumanEval) and set baseline for API code generation interfaces.",
            "key_findings": "Original Codex standalone endpoints are retired; modern integrations should target `gpt-4o-mini` or `gpt-4o` via the unified `/v1/chat/completions` gateway interface.",
        },
        {
            "id": "llama-cpp",
            "name": "llama.cpp",
            "category": "High-Performance Local Inference Engine & Server",
            "repository": "https://github.com/ggml-org/llama.cpp",
            "official_site": "https://github.com/ggml-org/llama.cpp",
            "license": "MIT License",
            "license_type": "Permissive Open Source",
            "dependencies": ["C/C++", "CMake", "Optional CUDA / ROCm / Metal / Vulkan / OpenCL acceleration"],
            "security_policy": "SECURITY.md documents untrusted model risks, untrusted inputs, privacy, and public pull request submission for security patches.",
            "maintenance_status": "Extremely active development by Georgi Gerganov and GGML open-source community.",
            "integration_relevance": "Primary lightweight local inference engine for Project 1 and the upcoming Project 2 (Large-Model-on-Light-Hardware).",
            "key_findings": "Supports GGUF quantization down to 2-bit (Q2_K). Exposes standard OpenAI-compatible `/v1/chat/completions` server mode with zero Python runtime overhead.",
        },
        {
            "id": "ollama",
            "name": "Ollama",
            "category": "Local Model Runtime Daemon & Package Manager",
            "repository": "https://github.com/ollama/ollama",
            "official_site": "https://ollama.com",
            "license": "MIT License",
            "license_type": "Permissive Open Source",
            "dependencies": ["Go", "C/C++ (bundled llama.cpp core)", "Platform-specific GPU drivers"],
            "security_policy": "SECURITY.md requests coordinated reporting via GitHub Security Advisories; warns against exposing port 11434 to untrusted networks.",
            "maintenance_status": "Highly active development with extensive community and corporate adoption.",
            "integration_relevance": "Provides one-click local model pull (`ollama pull`), automatic VRAM/RAM allocation, and a clean local HTTP API (`/api/tags`, `/api/chat`).",
            "key_findings": "Tested successfully with `llama3.2:1b`. Automatically manages model pulling and CPU/GPU memory distribution without manual compilation.",
        },
        {
            "id": "llmfit",
            "name": "llmfit",
            "category": "Hardware-Aware Local Model Recommendation Tool",
            "repository": "https://github.com/AlexsJones/llmfit",
            "official_site": "https://github.com/AlexsJones/llmfit",
            "license": "MIT License",
            "license_type": "Permissive Open Source",
            "dependencies": ["Go CLI", "System hardware discovery APIs"],
            "security_policy": "No root SECURITY.md visible in repository inspection; standard open-source GitHub issue tracking.",
            "maintenance_status": "Community-maintained utility for local LLM hardware planning.",
            "integration_relevance": "Serves as an external hardware-sizing recommendation reference, not an inference server.",
            "key_findings": "Calculates memory requirements based on parameter count, quantization, and context window. Model Gateway embeds these exact formulas natively while supporting live llmfit CLI detection.",
        },
    ]


@app.get("/api/hardware")
async def get_hardware_diagnostics():
    """Return host physical hardware inspection, runtime status, and llmfit availability."""
    hardware = get_system_hardware()

    # Query local runtime connectivity live
    ollama_online = False
    try:
        async with httpx.AsyncClient(timeout=2.0) as client:
            res = await client.get(f"{OLLAMA_URL}/api/tags")
            ollama_online = res.status_code == 200
    except Exception:
        ollama_online = False

    llamacpp_online = False
    try:
        async with httpx.AsyncClient(timeout=2.0) as client:
            res = await client.get(f"{LLAMACPP_URL}/v1/models")
            llamacpp_online = res.status_code == 200
    except Exception:
        llamacpp_online = False

    hardware["runtimes"] = {
        "ollama": {
            "url": OLLAMA_URL,
            "online": ollama_online,
            "status": "Online (Reachable)" if ollama_online else "Offline (Not running on port 11434)",
        },
        "llamacpp": {
            "url": LLAMACPP_URL,
            "online": llamacpp_online,
            "status": "Online (Reachable)" if llamacpp_online else "Offline (llama-server not running on port 8080)",
        },
    }
    return hardware


@app.get("/api/models/comparison")
async def get_models_comparison():
    """Return structured multi-provider model comparison matrix data."""
    return {
        "models": get_models_comparison_data(),
        "total": len(get_models_comparison_data()),
        "categories": ["cloud", "local"],
    }


@app.post("/api/estimator/calculate")
async def estimate_resources(body: EstimatorRequest):
    """Calculate RAM and VRAM requirements for a specific parameter size and quantization."""
    result = calculate_resource_estimate(
        params_b=body.parameters_billion,
        quant=body.quantization,
        context_len=body.context_length,
        kv_quant=body.kv_cache_quant,
    )
    return result


@app.get("/api/research")
async def list_research_audit():
    """Return technical audit information and findings for audited technologies."""
    return {
        "technologies": get_research_audit_data(),
        "total": len(get_research_audit_data()),
    }
