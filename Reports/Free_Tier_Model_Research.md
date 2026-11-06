# Free-Tier Model & Open-Weight Ecosystem Research
**Project 1 — Model Gateway & Provider Abstraction Initiative**

---

## 1. Executive Summary & Purpose

Modern AI engineering initiatives require balancing operational compute cost, latency, data privacy, and legal usage terms. This research investigates the current landscape of:

1. **Free-Tier Cloud AI APIs** (Hosted services providing free quota allocations)
2. **Open-Weight Models** (Pretrained model weights distributed openly for local execution)
3. **Local Model Runtimes** (Lightweight engines executing open weights without API costs)

This report establishes a rigorous technical taxonomy distinguishing between **Free API Access**, **Open-Weight Availability**, and **Locally Executable Models**.

---

## 2. Core Taxonomy: Three Tiers of Model Accessibility

```
┌────────────────────────────────────────────────────────────────────────┐
│ 1. FREE-TIER CLOUD APIS (Hosted SaaS)                                   │
│    - Compute: Cloud provider GPU clusters                              │
│    - Cost: Free within quotas; credit card or verified login required  │
│    - Privacy: Prompts often retained for model training                │
├────────────────────────────────────────────────────────────────────────┤
│ 2. OPEN-WEIGHT MODELS (Distributable Checkpoints)                       │
│    - Compute: Runs on user hardware or private cloud instances         │
│    - Cost: Zero API cost; hardware/electricity cost                    │
│    - License: Specific terms (Apache 2.0, Meta Community, MIT)         │
├────────────────────────────────────────────────────────────────────────┤
│ 3. LOCAL RUNTIME DAEMONS (Ollama / llama.cpp)                          │
│    - Compute: Local host CPU / GPU RAM                                 │
│    - Cost: 100% Free, zero network egress                              │
│    - Privacy: Complete local data isolation (Zero data leakage)        │
└────────────────────────────────────────────────────────────────────────┘
```

---

## 3. Comparative Research & Empirical Verification Matrix

| Provider | Model Identifier | Accessibility Tier | Authentication Method | Free-Tier Quota & Rate Limits | Commercial Use Rights | Data Privacy Guarantee | Actual Test Status in Project 1 |
|---|---|---|---|---|---|---|---|
| **Google Gemini** | `gemini-2.5-flash` | Hosted Free Cloud API | API Key (Query param) | **15 RPM / 1M TPM / 1,500 RPD** on Google AI Studio | Permitted under Google API Terms | **No:** Free-tier inputs may be reviewed by human trainers | **Passed (HTTP 200)** <br>Generated text verified live. |
| **Google Gemini** | `gemini-1.5-flash` | Hosted Free Cloud API | API Key (Query param) | **15 RPM / 1M TPM / 1,500 RPD** | Permitted under Google API Terms | **No:** Free tier data used for model improvement | **Passed** <br>Discovered in API `/models`. |
| **Google Gemini** | `gemini-1.5-pro` | Hosted Free Cloud API | API Key (Query param) | **2 RPM / 32k TPM / 50 RPD** | Permitted under Google API Terms | **No:** Free tier data used for model improvement | **Model 404** <br>String format mismatch in test. |
| **OpenAI** | `gpt-4o-mini` | Hosted Cloud API | HTTP Bearer Token | Initial grant on new accounts (expires in 3 mos); requires paid credit | Permitted under OpenAI Terms | **Yes:** API data not trained on by default | **Failed (HTTP 429)** <br>Quota exhausted; requires balance. |
| **OpenAI** | `gpt-4o` | Hosted Cloud API | HTTP Bearer Token | Tier-dependent; pay-as-you-go billing required | Permitted under OpenAI Terms | **Yes:** API data not trained on by default | **Documented** <br>Production flagship model. |
| **Qwen / DashScope** | `qwen-plus` | Hosted Cloud API | HTTP Bearer Token | Promotional trial credits granted on initial registration | Permitted under Alibaba Cloud Terms | Governed by DashScope terms | **Unconfigured** <br>Key unconfigured in current `.env`. |
| **Meta Llama** | `llama3.2:1b` | Open Weights / Local | None (Local execution) | **Unlimited** <br>(Hardware throughput bound) | Free commercial use up to **700M monthly active users** | **100% Local:** Zero external network egress | **Passed (HTTP 200)** <br>Generated text verified on Ollama. |
| **Meta Llama** | `llama3.2:3b` | Open Weights / Local | None (Local execution) | **Unlimited** <br>(Hardware throughput bound) | Free commercial use up to **700M monthly active users** | **100% Local:** Zero external network egress | **Supported** <br>Compatible with local Ollama. |
| **QwenLM** | `Qwen3.5-0.8B-GGUF` | Open Weights / Local | None (Local execution) | **Unlimited** <br>(Hardware throughput bound) | **Apache 2.0:** Fully unrestricted commercial use | **100% Local:** Zero external network egress | **Passed (HTTP 200)** <br>Verified with `llama-server`. |
| **QwenLM** | `Qwen2.5-Coder-7B` | Open Weights / Local | None (Local execution) | **Unlimited** <br>(Hardware throughput bound) | **Apache 2.0:** Fully unrestricted commercial use | **100% Local:** Zero external network egress | **Supported** <br>Sized via Resource Estimator. |

---

## 4. In-Depth Provider Analysis

### 4.1. Google Gemini AI Studio (Best Free-Tier Developer Cloud API)
- **Free Quota:** Google AI Studio offers the most generous permanent free tier in the cloud industry:
  - **15 Requests Per Minute (RPM)**
  - **1,000,000 Tokens Per Minute (TPM)**
  - **1,500 Requests Per Day (RPD)**
- **Supported Multimodal Capabilities:** Text, high-resolution images, video files (up to 1 hour), audio recordings, and PDF documents within a massive **1,048,576 token context window**.
- **Crucial Trade-off (Data Privacy):** Prompts submitted through the AI Studio free tier **are logged and used by Google human reviewers to train future foundation models**. It is ideal for open-source development, proofs-of-concept, and public chat, but strictly prohibited for confidential enterprise knowledgebases.

---

### 4.2. OpenAI API (Commercial Model with Exhausted Free Quotas)
- **Status:** OpenAI no longer provides a recurring free tier for API developers. New accounts historically receive a promotional grant ($5–$18) that expires after 90 days.
- **Observed Behavior:** As observed in our laboratory tests, issuing a request with a valid API key but zero prepaid credit balance returns **HTTP 429 (`insufficient_quota`)**.
- **Significance for Model Gateway:** The gateway handles this gracefully by distinguishing connection validation (which succeeds via `GET /v1/models`) from token generation (which returns a clear quota notice).

---

### 4.3. Alibaba Cloud DashScope / Qwen Compatible Mode
- **Status:** Provides temporary free trial token allocations for newly registered international and domestic accounts.
- **Architecture:** Exposes an OpenAI-compatible interface (`/compatible-mode/v1/chat/completions`), allowing seamless drop-in integration without rewriting client code.
- **Open-Weight Alternative:** Developers who do not wish to use hosted DashScope APIs can download the exact same `Qwen2.5-Coder` weights under the **Apache 2.0 license** and run them locally via Ollama or llama.cpp with zero API charges.

---

### 4.4. Meta Llama 3.2 (Premier Open-Weight Family)
- **Model Family:** `1B`, `3B`, `8B`, `70B`.
- **Accessibility:** Distributed via Hugging Face and Ollama Hub.
- **Commercial Restrictions:** The **Llama 3.2 Community License** grants free commercial deployment for software applications with fewer than 700 million monthly active users. If an enterprise exceeds 700M MAU, a formal commercial contract must be executed with Meta.
- **Performance Trade-offs:** The 1B variant (`llama3.2:1b`) runs in under 1.5 GB of RAM, enabling instantaneous local generation even on low-end laptops. However, laboratory testing revealed that 1B weights exhibit prompt drift and lower instruction-following adherence compared to larger 7B+ models or Gemini Flash.

---

## 5. Strategic Recommendations for AI Initiatives

1. **Development & Prototyping:** Use **Google Gemini 2.5 Flash** for rapid frontend and application prototyping due to its generous 15 RPM free tier and zero cost.
2. **Confidential & Proprietary Data (Project 3 Alignment):** Route all sensitive internal company documents, customer records, and codebases exclusively to **Local Open-Weight Models (Ollama / llama.cpp)** to guarantee 100% data privacy and eliminate cloud data retention risks.
3. **Hardware-Constrained Production (Project 2 Alignment):** Deploy quantized GGUF models (`Q4_K_M` or `Q5_K_M`) using `llama.cpp` to achieve optimal tokens-per-second throughput within existing physical RAM constraints.

