# Provider Compatibility Matrix & Verification Report
**Project 1 — Model Gateway & Multi-Provider Abstraction Platform**

---

## 1. Executive Summary & Methodology

This document details the compatibility, configuration procedures, API behaviors, rate limits, and empirical test results for all AI providers integrated into the **Model Gateway**. 

A central architectural finding of this project is that **connection testing, model listing, and text generation evaluate fundamentally distinct operational layers**:
1. **Connection Test:** Validates basic transport reachability, endpoint DNS resolution, and initial authentication handshake.
2. **Model Listing (`get_models()`):** Checks whether the provider's discovery endpoint (`/models`, `/v1/models`, or `/api/tags`) is supported and authorized.
3. **Chat Generation (`generate()`):** Verifies full end-to-end inference, token budget availability, model endpoint routing, safety filters, and response schema parsing.

A provider can pass a connection check completely while still failing chat generation due to quota exhaustion (HTTP 429), model retirement (HTTP 404), or prompt rejection.

---

## 2. Empirical Verification Matrix

The results below reflect actual laboratory tests executed on this platform. Previous failure observations (such as OpenAI HTTP 429 and Gemini Pro HTTP 404) are rigorously preserved as empirical evidence.

| Provider / Model Identifier | Category | Authentication Handshake | Model Listing Discovery | Chat Generation Result | Observed Behavior & Laboratory Findings | Status Verdict |
|---|---|---|---|---|---|---|
| **Google Gemini** <br>`gemini-2.5-flash` | Cloud API | **Passed** <br>(API key param) | **Passed** <br>(47 models discovered) | **Passed** <br>(HTTP 200) | Successfully returned text: *"Hello! How can I help you today?"* and *"Model Gateway"* in test runs. Lowest latency cloud tier. | **Operational & Verified** |
| **Google Gemini** <br>`gemini-2.5-pro` | Cloud API | **Passed** | Failed via endpoint | **Failed** <br>(HTTP 404) | Request returned HTTP 404 for model identifier or endpoint syntax. Standard production API requires canonical model strings. | **Model String Mismatch (404)** |
| **Google Gemini** <br>`nano-banana-pro-preview` | Cloud API | **Passed** | Not confirmed | **Failed** <br>(Quota / 429) | Preview endpoint returned immediate quota / rate-limit rejection. Preview tier rate limits are strictly enforced. | **Quota Exceeded** |
| **OpenAI** <br>`gpt-4o-mini` | Cloud API | **Passed** <br>(Bearer token) | **Passed** <br>(110 models discovered) | **Failed** <br>(HTTP 429) | Connection handshake succeeded and listed 110 models. Chat completions returned HTTP 429: account quota exhausted / prepaid credit required. | **Quota Exhausted (429)** |
| **Qwen / DashScope** <br>`qwen-plus` | Cloud API | **Available** <br>(Bearer token) | Fallback defaults | **Unconfirmed** <br>(Key unconfigured) | DashScope OpenAI-compatible mode adapter implemented. Key unconfigured in current `.env` environment. | **Unconfigured** |
| **Custom OpenAI API** <br>`(User specified HTTPS)` | Cloud API | Bearer token / None | Dynamic `/models` | Dynamic `/chat/completions` | Enforces strict SSRF protections: blocks `localhost`, `127.0.0.1`, private IP blocks (10.x, 192.168.x, 172.16.x), and raw IP literals. | **Security Active** |
| **Ollama** <br>`llama3.2:1b` | Local Daemon | **Passed** <br>(No auth needed) | **Passed** <br>(1 installed model) | **Passed** <br>(HTTP 200) | Reachable at `http://127.0.0.1:11434`. Generated response successfully (*"Data Management"*), though smaller 1B weights exhibited prompt drift. | **Operational & Verified** |
| **llama.cpp Server** <br>`ggml-org/Qwen3.5-0.8B-GGUF` | Local Server | **Passed** <br>(No auth needed) | **Passed** <br>(`/v1/models`) | **Passed** <br>(HTTP 200) | Verified in Week 4 tests with local `llama-server`. Server must be launched in a dedicated terminal window on port 8080. | **Operational (Requires Server Run)** |

---

## 3. Comprehensive Provider Setup & Configuration Guide

### 3.1. Google Gemini (Cloud)
- **Adapter Class:** `GeminiAdapter` in `main.py`
- **Authentication Method:** API key passed via query parameter `?key={GEMINI_API_KEY}`
- **Base Endpoint:** `https://generativelanguage.googleapis.com/v1beta`
- **Environment Variable:** `GEMINI_API_KEY`
- **Setup Instructions:**
  1. Visit Google AI Studio at https://aistudio.google.com/app/apikey.
  2. Create a free API key in your Google Cloud / AI Studio project.
  3. Open `Model-gateway/.env` and configure:
     ```env
     GEMINI_API_KEY=AIzaSy...your_actual_key_here
     ```
  4. Models available include `gemini-2.5-flash`, `gemini-1.5-flash`, and `gemini-1.5-pro`.
- **Rate Limits (Free Tier):**
  - `gemini-2.5-flash` / `gemini-1.5-flash`: **15 RPM** (Requests Per Minute), **1,000,000 TPM** (Tokens Per Minute), **1,500 RPD** (Requests Per Day).
- **Known Limitations:**
  - Free-tier prompts may be used to improve Google products (per Google AI Studio terms).
  - Certain experimental or preview model identifiers change rapidly and return HTTP 404 when discontinued.

---

### 3.2. OpenAI (Cloud)
- **Adapter Class:** `OpenAIAdapter` in `main.py`
- **Authentication Method:** HTTP Header `Authorization: Bearer {OPENAI_API_KEY}`
- **Base Endpoint:** `https://api.openai.com/v1`
- **Environment Variable:** `OPENAI_API_KEY`
- **Setup Instructions:**
  1. Visit OpenAI Developer Platform at https://platform.openai.com/api-keys.
  2. Generate a secret API key (`sk-proj-...`).
  3. Add credit balance ($5 minimum) to your OpenAI organization billing account.
  4. Configure in `Model-gateway/.env`:
     ```env
     OPENAI_API_KEY=sk-proj-your_actual_key_here
     ```
- **Rate Limits & Billing Restrictions:**
  - Free trial credits expire after 3 months; accounts without active prepaid credit return **HTTP 429 (`insufficient_quota`)**.
  - Tier 1 accounts have standard limits (500 RPM, 30,000 TPM for GPT-4o).
- **Known Limitations:**
  - Chat completions strictly require prepaid balance; connection checks and model discovery (`GET /v1/models`) may succeed even when chat generation is blocked by zero balance.

---

### 3.3. Qwen / DashScope (Cloud)
- **Adapter Class:** `QwenAPIAdapter` in `main.py`
- **Authentication Method:** HTTP Header `Authorization: Bearer {DASHSCOPE_API_KEY}`
- **Base Endpoint:** `https://dashscope-intl.aliyuncs.com/compatible-mode/v1` (International) or `https://dashscope.aliyuncs.com/compatible-mode/v1` (Mainland China)
- **Environment Variable:** `DASHSCOPE_API_KEY` and optional `QWEN_BASE_URL`
- **Setup Instructions:**
  1. Register at Alibaba Cloud DashScope console: https://dashscope.console.aliyun.com/.
  2. Generate an API Key in the DashScope console.
  3. Configure in `Model-gateway/.env`:
     ```env
     DASHSCOPE_API_KEY=sk-your_dashscope_key_here
     QWEN_BASE_URL=https://dashscope-intl.aliyuncs.com/compatible-mode/v1
     ```
- **Supported Models:** `qwen-plus`, `qwen-turbo`, `qwen-max`, `qwen2.5-72b-instruct`, `qwen2.5-coder-32b-instruct`.
- **Known Limitations:**
  - Free tier is granted as a promotional quota with an expiration window. Once expired, token billing applies.

---

### 3.4. Custom OpenAI-Compatible Endpoints (Cloud / Hybrid)
- **Adapter Class:** `CustomOpenAICompatibleAdapter` in `main.py`
- **Authentication Method:** Optional HTTP Header `Authorization: Bearer {CUSTOM_API_KEY}`
- **Security Validation:** Enforces strict SSRF protection via `validate_custom_url()`:
  - Protocol must be **HTTPS**. Plain `http://` is forbidden.
  - Hostnames resolving to loopback (`127.0.0.1`, `::1`), private networks (`10.0.0.0/8`, `172.16.0.0/12`, `192.168.0.0/16`), or link-local (`169.254.0.0/16`) are blocked via DNS pre-flight verification.
  - User credentials inside URLs (`https://user:pass@host`) are stripped and rejected.
- **Setup Instructions:**
  1. Specify the public HTTPS URL in the dashboard or via `CUSTOM_BASE_URL`.
  2. Set optional key in `Model-gateway/.env`:
     ```env
     CUSTOM_API_KEY=your_custom_key_here
     ```

---

### 3.5. Ollama (Local Runtime Daemon)
- **Adapter Class:** `OllamaAdapter` in `main.py`
- **Authentication Method:** None required (Local loopback daemon)
- **Base Endpoint:** `http://127.0.0.1:11434`
- **Environment Variable:** `OLLAMA_BASE_URL` (default: `http://127.0.0.1:11434`)
- **Setup Instructions:**
  1. Download and install Ollama from https://ollama.com.
  2. Verify that the Ollama background daemon is running.
  3. Pull your desired models via terminal:
     ```bash
     ollama pull llama3.2:1b
     ollama pull qwen2.5-coder:7b
     ```
  4. The Model Gateway automatically detects installed models through `GET /api/tags`.
- **Known Limitations:**
  - Inference speed depends entirely on host CPU and GPU VRAM capacity.
  - Gateway will not automatically trigger multi-gigabyte background downloads; models must be pulled via CLI prior to selection.

---

### 3.6. llama.cpp HTTP Server (Local Inference)
- **Adapter Class:** `LlamaCppAdapter` in `main.py`
- **Authentication Method:** None required (Local loopback server)
- **Base Endpoint:** `http://127.0.0.1:8080`
- **Environment Variable:** `LLAMACPP_BASE_URL` (default: `http://127.0.0.1:8080`)
- **Setup Instructions:**
  1. Download precompiled `llama.cpp` binaries or build from source (https://github.com/ggml-org/llama.cpp).
  2. Download a GGUF quantized model (e.g., from Hugging Face).
  3. Launch the server in a separate terminal:
     ```bash
     llama-server -m models/Qwen3.5-0.8B-GGUF.gguf --port 8080 -c 4096 -ngl 99
     ```
  4. Keep the terminal active. Model Gateway communicates via standard OpenAI `/v1/chat/completions` and `/v1/models` endpoints.
- **Known Limitations:**
  - Only one active model file is served per `llama-server` process instance. Switching models requires restarting the server process with a different `-m` flag.

---

## 4. Architectural Verification Conclusions

1. **Seamless Provider Switching:** Switching providers in the React dashboard instantly swaps the active adapter in `main.py` without restarting the FastAPI backend.
2. **Graceful Degraded States:** When a local server is offline (e.g., `llama-server` on port 8080), the gateway returns clear, actionable error messages (`HTTP 503: Could not connect to llama.cpp Server. Verify that the service is running.`) instead of crashing or hanging.
3. **Verified Multi-Provider Working POC:** Google Gemini (Cloud) and Ollama `llama3.2:1b` (Local) are independently verified and operational on this machine.
