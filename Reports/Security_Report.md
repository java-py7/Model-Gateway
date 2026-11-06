# Security Audit & Threat Model Report
**Project 1 — Model Gateway & Provider Abstraction Initiative**

---

## 1. Executive Security Architecture

The **Model Gateway** serves as a centralized intermediary between untrusted client browsers, external cloud AI APIs, and local machine-learning execution environments. Because the gateway handles proprietary credentials, executes network calls, and interfaces with local OS sockets, a rigorous defense-in-depth security model is mandatory.

```
┌─────────────────┐       HTTPS / CORS        ┌─────────────────────────┐
│ Browser Client  │ ◄───────────────────────► │ Model Gateway (FastAPI) │
└─────────────────┘                           └────────────┬────────────┘
                                                           │
               ┌───────────────────────────────────────────┴───────────────────────────────────────────┐
               ▼                                                                                       ▼
┌───────────────────────────────┐                                                       ┌───────────────────────────────┐
│ External Cloud Providers      │                                                       │ Local Inference Engines       │
│ (Gemini, OpenAI, DashScope)   │                                                       │ (Ollama :11434, llama :8080)  │
│ Strict Key Isolation in .env  │                                                       │ Bound strictly to 127.0.0.1   │
└───────────────────────────────┘                                                       └───────────────────────────────┘
```

This report documents the security controls, threat mitigations, and operational practices implemented in the platform.

---

## 2. Threat Vector Analysis & Implemented Mitigations

### 2.1. API Key Protection & Environment Variable Handling
- **Threat Vector:** Hardcoding provider API keys in frontend code, committing `.env` files to version control, or returning secret keys in client-facing JSON payloads exposes accounts to unauthorized access, billing theft, and quota exhaustion.
- **Implemented Controls:**
  - All secret keys (`GEMINI_API_KEY`, `OPENAI_API_KEY`, `DASHSCOPE_API_KEY`, `CUSTOM_API_KEY`) are read strictly on the backend server from `Model-gateway/.env` via `python-dotenv`.
  - `.env` is explicitly registered in `.gitignore` and verified before committing.
  - Template placeholders are documented in `Model-gateway/.env.example` (e.g., `GEMINI_API_KEY=your_gemini_api_key_here`). No real keys exist in example files.
  - The `GET /api/providers` and `GET /api/settings` endpoints return **only boolean flags (`configured: true`) and masked visual strings (`••••••••`)**. Provider API keys are NEVER sent to the client browser.

---

### 2.2. SSRF Protection & Custom URL Validation
- **Threat Vector:** Enabling users to specify custom OpenAI-compatible endpoints creates a high-severity **Server-Side Request Forgery (SSRF)** vulnerability. Malicious actors could specify `http://127.0.0.1:11434`, `http://169.254.169.254` (cloud metadata service), internal intranet IPs (`10.0.0.1`), or embedded credentials (`https://user:pass@host`).
- **Implemented Controls (`validate_custom_url()` in `main.py`):**
  - **Protocol Enforcement:** Requires strict `https://`. Unencrypted plain `http://` is immediately rejected.
  - **Credential Rejection:** URLs containing embedded usernames or passwords are blocked.
  - **Hostname Filtering:** Blocks `localhost`, `localhost.localdomain`, `*.local`, and `*.internal`.
  - **IP Literal Filtering:** Parses IP literals via Python `ipaddress`. Blocks private (`10.0.0.0/8`, `172.16.0.0/12`, `192.168.0.0/16`), loopback (`127.0.0.0/8`), link-local (`169.254.0.0/16`), multicast, and non-global IP blocks.
  - **DNS Resolution Pre-flight Check:** Performs DNS lookup via `socket.getaddrinfo()` and checks *all returned A/AAAA records* against non-public IP ranges before initiating any outbound HTTP request.

---

### 2.3. Cross-Origin Resource Sharing (CORS) Boundaries
- **Threat Vector:** Wildcard CORS configurations (`allow_origins=["*"]`) allow arbitrary external websites visited by the developer to issue background fetch requests to the local gateway at `http://127.0.0.1:8000`.
- **Implemented Controls:**
  - `CORSMiddleware` in `main.py` strictly whitelists explicit frontend origins configured via `CORS_ORIGINS`:
    ```
    http://127.0.0.1:8000, http://localhost:8000, http://127.0.0.1:5173, http://localhost:5173, http://127.0.0.1:3000, http://localhost:3000
    ```
  - `allow_credentials` is set to `False`. Wildcard origins are rejected.

---

### 2.4. Local Inference Server Exposure
- **Threat Vector:** Local inference runtimes (Ollama on port `11434`, `llama-server` on port `8080`) do not implement authentication by default. Binding to `0.0.0.0` exposes local GPU/CPU compute to the entire local network or public internet.
- **Implemented Controls:**
  - Default URLs configured in gateway: `http://127.0.0.1:11434` and `http://127.0.0.1:8080`.
  - Documentation and diagnostics advise keeping inference servers bound strictly to `127.0.0.1` unless placed behind an authenticated reverse proxy (e.g. NGINX with TLS and mTLS/API tokens).

---

### 2.5. Untrusted Model Files & Binary Exploits
- **Threat Vector:** Downloading untrusted `.gguf`, `.bin`, or pickle-based model weights from unverified repositories presents buffer overflow, memory corruption, or arbitrary code execution risks during tensor loading.
- **Implemented Controls:**
  - Standardized on GGUF tensor format (which avoids Python pickle-based arbitrary execution).
  - Model Gateway does not execute autonomous background downloads; users pull verified models explicitly using official Ollama or Hugging Face repositories.
  - Sizing estimator validates model parameter bounds before loading.

---

### 2.6. Prompt Injection & Input Validation
- **Threat Vector:** Malicious user inputs designed to trigger unexpected provider behavior, exceed context windows, or cause server memory exhaustion.
- **Implemented Controls:**
  - Pydantic models (`ChatRequest`, `TestRequest`, `EstimatorRequest`) enforce strict schema validation:
    - `category`: constrained to regex `^(cloud|local)$`.
    - `message`: capped at 12,000 characters.
    - `provider`: length bounded (max 40 characters).
    - `model`: length bounded (max 160 characters).
  - Empty or whitespace-only inputs are rejected with HTTP 400.

---

### 2.7. Provider Error Sanitization & Rate-Limit Handling
- **Threat Vector:** Leaking raw provider stack traces or HTTP request dumps could expose internal bearer tokens, backend IP addresses, or provider internals. Unhandled 429 quota errors lead to cascading retries that worsen account suspensions.
- **Implemented Controls (`request_json()` in `main.py`):**
  - All outbound requests utilize a centralized helper with uniform timeout (default 45s) via `httpx.AsyncClient`.
  - Specific HTTP status codes are mapped to sanitized, user-friendly error responses:
    - **HTTP 401 / 403:** Mapped to `"Authentication failed for {provider}. Check your API key in .env."` (Tokens stripped).
    - **HTTP 404:** Mapped to `"The requested endpoint or model was not found on {provider}."`
    - **HTTP 429:** Mapped to `"Rate limit or quota exceeded for {provider}. Check account billing and quota limits."`
    - **HTTP 503 / ConnectError:** Mapped to `"Could not connect to {provider}. Verify that the service is running."`
    - **HTTP 504 / TimeoutException:** Mapped to `"Request to {provider} timed out after {TIMEOUT}s."`

---

### 2.8. Cloud Data Privacy & Data Retention Gates
- **Threat Vector:** Submitting sensitive corporate data or confidential customer information to public cloud free-tier APIs (e.g., Google AI Studio free tier) where prompts may be logged for model training.
- **Implemented Controls:**
  - Clear architectural guidance and visual warning badges in the dashboard.
  - Project 3 (Knowledge Chatbot) alignment: Sensitive enterprise knowledgebases must be routed exclusively to local inference engines (Ollama / llama.cpp) or enterprise cloud endpoints with signed Zero Data Retention (ZDR) agreements.

---

### 2.9. Browser-to-Localhost Security (Local Runtime Bridge)
- **Threat Vector:** Malicious cross-site scripting, unauthorized intranet port scans, or proxying local model weights through cloud infrastructure.
- **Implemented Controls:**
  1. **Strict Loopback Binding:** Local daemons (Ollama on `11434`, llama-server on `8080`) bind exclusively to loopback `127.0.0.1` and are never exposed publicly to the internet.
  2. **Zero Command Execution:** The gateway application strictly forbids and never executes shell commands on visitor machines. All daemon commands are presented as user-copyable terminal instructions.
  3. **No Cloud Hop for Local Weights:** Local AI requests route directly between the visitor's browser and their local loopback interface. Prompts and weights are never transmitted to Render cloud infrastructure.
  4. **Explicit Origin Controls (`OLLAMA_ORIGINS`):** The application guides visitors to configure explicit origin rules on their local daemon rather than relying on unauthenticated wildcards.
  5. **No Telemetry Spam:** Local health checks are triggered strictly upon user interaction (selecting local category, clicking refresh, or testing connection); no automated background port scanning loops run against the user's machine.

---

## 3. Security Verification Checklist

| Security Control | Verification Procedure | Status |
|---|---|---|
| **Secret Isolation** | Audited Git status and files; confirmed `.env` excluded, no keys in frontend | **Verified** |
| **Masked Telemetry** | Inspected `GET /api/providers` and `GET /api/settings`; keys never returned | **Verified** |
| **SSRF Mitigation** | Tested IP literals, `localhost`, and DNS resolutions in `validate_custom_url` | **Verified** |
| **CORS Boundaries** | Whitelist configured for localhost and 127.0.0.1 ports (8000, 5173, 3000) | **Verified** |
| **Timeout Protection** | Configurable 45s timeout prevents hanging connections on slow runtimes | **Verified** |
| **Error Sanitization** | Provider errors sanitized; no auth headers or stack traces leaked | **Verified** |
| **Input Validation** | Pydantic regex and length constraints enforced on all endpoints | **Verified** |
| **Local Port Isolation** | Ollama and llama.cpp run on loopback interface (`127.0.0.1`) | **Verified** |
| **Client Bridge Privacy** | Local prompts connect directly from browser to localhost; zero cloud hop | **Verified** |
| **Zero Auto-Execution** | No automated terminal commands executed on client machines | **Verified** |
