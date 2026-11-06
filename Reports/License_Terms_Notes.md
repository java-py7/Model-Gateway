# License, Model Weights & Hosted Service Terms Notes
**Project 1 — Model Gateway & Provider Abstraction Initiative**

---

## 1. Executive Legal Taxonomy & Scope

A fundamental engineering principle established in this project is the **strict separation between three distinct legal layers in AI systems**:

```
┌─────────────────────────────────────────────────────────────┐
│ 1. SOFTWARE REPOSITORY LICENSE                             │
│    (Governs application source code: Python, C++, Go, etc.) │
├─────────────────────────────────────────────────────────────┤
│ 2. MODEL WEIGHT / ARTIFACT LICENSE                          │
│    (Governs binary checkpoint weights, neural parameters)    │
├─────────────────────────────────────────────────────────────┤
│ 3. HOSTED CLOUD API TERMS OF SERVICE                        │
│    (Governs SaaS endpoint usage, data privacy, telemetry)   │
└─────────────────────────────────────────────────────────────┘
```

An open-source software license (such as MIT or Apache 2.0) applied to an inference engine or client application **never automatically grants unrestricted commercial rights to the models executed by that software, nor does it override cloud API terms of service**.

---

## 2. Software Repository Code Licenses

| Project / Software | Code License | Commercial Use Rights | Key Obligations & Requirements | Trademark Restrictions |
|---|---|---|---|---|
| **Model Gateway (Our Project)** | MIT License | Unrestricted | Retain copyright notice in copies. Software provided "as is". | N/A |
| **Qwen Code** | Apache License 2.0 | Permissive | Retain copyright, license notices, and state changes. Patent grants included. | Explicitly does NOT grant trademark use rights for "Qwen" or "Alibaba". |
| **llama.cpp** | MIT License | Permissive | Retain original copyright & permission notice. | No trademark grants. |
| **Ollama** | MIT License | Permissive | Retain original copyright & permission notice. | "Ollama" is a registered trademark of Ollama Inc. |
| **llmfit** | MIT License | Permissive | Retain copyright notice. | No trademark grants. |
| **Claude Code** | Proprietary CLI | Commercial Subscription | Bound to Anthropic Commercial Terms of Service; no redistribution rights. | Protected Anthropic trademarks. |

---

## 3. Model Weights & Parameter Licenses

Open-weight models downloaded and run locally (via Ollama or llama.cpp) have independent licenses that must be audited prior to enterprise or commercial deployment:

### 3.1. Meta Llama 3.2 Community License
- **Applies to:** `llama3.2:1b`, `llama3.2:3b`, `llama3:8b`, `llama3:70b`.
- **Commercial Rights:** Permissive commercial use for businesses with **under 700 million Monthly Active Users (MAU)** during the preceding calendar month. If monthly active users exceed 700M, a formal commercial license must be requested from Meta.
- **Redistribution & Attribution:** Must include "Built with Meta Llama 3" in consumer-facing notices. Modifications must retain the original license.
- **Restrictions:** Cannot be used to train or improve other language models (excluding fine-tunes of Llama itself).

### 3.2. Qwen Model Licenses (Alibaba Cloud)
- **Applies to:** `Qwen2.5-Coder`, `Qwen3.5-0.8B-GGUF`.
- **Qwen <= 32B Models:** Released under the **Apache License 2.0**. Fully permissive commercial use, redistribution, and fine-tuning.
- **Qwen 72B Models:** Subject to the **Qwen Research & Commercial License**. Free commercial use is granted for entities with under 100 million monthly active users; larger commercial deployments require Alibaba authorization.

### 3.3. Mistral AI Models
- **Applies to:** `Mistral-7B-Instruct-v0.3`.
- **License:** **Apache License 2.0**. Unrestricted commercial exploitation, redistribution, and parameter fine-tuning.

---

## 4. Hosted Cloud Provider Terms of Service

Cloud APIs operate under software-as-a-service terms, regardless of whether the underlying model architecture is proprietary or open-source:

### 4.1. Google Gemini (Google AI Studio / Vertex AI)
- **Free Tier Terms (Google AI Studio):**
  - Prompt inputs and generated completions **may be logged and reviewed by human reviewers to improve Google products and services**.
  - **Zero Data Privacy Guarantee on Free Tier:** Must NEVER submit proprietary corporate data, trade secrets, confidential source code, or personally identifiable information (PII) on the Gemini AI Studio free tier.
- **Commercial Paid Tier (Vertex AI / Pay-as-you-go):**
  - Customer data is NOT used to train Google models. Complies with SOC 2, HIPAA, and GDPR standards.

### 4.2. OpenAI API
- **API Data Usage Terms:**
  - By default, OpenAI **does not train models on data submitted via API endpoints** (unlike the consumer ChatGPT web interface).
  - Data is retained for up to 30 days for abuse and misuse monitoring, after which it is deleted unless required by law.
  - Zero-data-retention (ZDR) agreements are available for qualifying enterprise accounts.
- **Restrictions:** Users may not reverse engineer model outputs to build competing language models, nor violate OpenAI Usage Policies.

### 4.3. Alibaba Cloud DashScope
- **API Terms:** Governed by Alibaba Cloud International Customer Agreement and DashScope Terms of Service.
- **Restrictions:** Data residency and cross-border data transfer regulations apply depending on whether the international (`dashscope-intl.aliyuncs.com`) or mainland China endpoint is selected.

---

## 5. Practical Compliance Checklist for Enterprise Deployment

When releasing or packaging applications that utilize the Model Gateway:

- [x] **Code Retention:** Retain all MIT and Apache 2.0 copyright notices for bundled open-source dependencies.
- [x] **Weight Licensing:** Check the Model Card on Hugging Face or Ollama Hub for each specific GGUF model file prior to production hosting.
- [x] **Attribution Requirements:** Display required badges (e.g., *"Built with Meta Llama 3"*) where mandated by model licenses.
- [x] **Enterprise Privacy Gate (Project 3 Alignment):** For the upcoming Company Knowledge Chatbot Builder, route all proprietary corporate documents strictly to **local models (Ollama / llama.cpp)** or enterprise-grade cloud endpoints with signed Zero Data Retention (ZDR) agreements.
- [x] **Credential Confidentiality:** Never commit `.env` files, API keys, or provider access tokens to version control.
- [x] **Rate Limit Backoff:** Comply with cloud provider rate limits (e.g. Gemini 15 RPM) to prevent account suspension.
