# Technical Recommendations: Architectural Bridge for Projects 2 and 3
**Project 1 — Model Gateway & Provider Abstraction Initiative**

---

## 1. Executive Vision & Platform Synergies

**Project 1 (Model Gateway)** establishes the core architectural foundation for the entire AI Engineering Roadmap. By solving provider abstraction, credential isolation, model discovery, and hardware sizing, Project 1 serves as the shared infrastructure powering two distinct upcoming initiatives:

```
                          ┌─────────────────────────────────────┐
                          │     PROJECT 1 — MODEL GATEWAY       │
                          │  - Unified Provider Abstraction     │
                          │  - Cloud & Local Runtime Adapters   │
                          │  - Hardware Sizing Formulas         │
                          │  - Security & Credential Isolation  │
                          └──────────────────┬──────────────────┘
                                             │
                      ┌──────────────────────┴──────────────────────┐
                      ▼                                             ▼
       ┌───────────────────────────────┐             ┌───────────────────────────────┐
       │   PROJECT 2 — LIGHTWEIGHT     │             │   PROJECT 3 — ENTERPRISE      │
       │   INFERENCE ENGINE            │             │   KNOWLEDGE CHATBOT BUILDER   │
       │  - Large-Model-on-Light-HW    │             │  - Document RAG Pipeline      │
       │  - Deep llama.cpp Quantization│             │  - Privacy Routing (Local/HQ) │
       │  - Layer GPU/CPU Offloading   │             │  - Grounded Knowledge Serving │
       └───────────────────────────────┘             └───────────────────────────────┘
```

This report provides detailed architectural recommendations, technical specifications, risk analyses, and sequential next steps for building **Project 2** and **Project 3** upon the Model Gateway foundation.

---

## 2. Supporting Project 2: Large-Model-on-Light-Hardware Engine

### 2.1. Strategic Objective
Project 2 focuses on executing large generative language models (7B, 14B, and 32B parameter weights) on constrained commodity consumer hardware (e.g., laptops with 8 GB to 16 GB of system RAM and integrated or low-tier discrete GPUs).

### 2.2. Architectural Contributions from Project 1
1. **Local Runtime Abstraction:** Project 1's `LlamaCppAdapter` and `OllamaAdapter` provide the exact HTTP client interfaces needed to communicate with quantized local processes without binding the rest of the application to binary execution harnesses.
2. **Hardware Sizing Engine (`/api/estimator/calculate`):** The memory formulas implemented in Project 1 (calculating weights memory, KV cache allocation, and activation overhead) provide Project 2 with an automated layer-offloading calculator.
3. **Dynamic Host Inspection (`/api/hardware`):** Project 1 automatically detects host physical RAM, available memory, CPU cores, and GPU VRAM via native platform calls, allowing Project 2 to compute optimal `--n-gpu-layers` parameters dynamically before launching inference.

### 2.3. Recommended Technical Architecture for Project 2
- **Core Engine:** **llama.cpp** compiled with hardware-specific BLAS backends (e.g., OpenBLAS on standard x86, CUDA on NVIDIA, Metal on Apple Silicon).
- **Quantization Standard:** Standardize on **GGUF `Q4_K_M`** and **`Q5_K_M`** (K-quants) as the default format. K-quants preserve attention tensor precision while quantizing feed-forward layers down to 4.5 bits/weight, achieving >98% perplexity retention of FP16 models.
- **Context Management:** Implement **PagedAttention** and quantized KV caches (`--cache-type-k q8_0 --cache-type-v q8_0`) to reduce context memory consumption by up to 50% compared to standard FP16 KV buffers.
- **Process Orchestration:** Build a lightweight Python supervisor service that manages the `llama-server` process lifecycle, launching instances with optimal flags computed from the Project 1 hardware estimator:
  ```bash
  llama-server -m models/qwen2.5-coder-7b-q4_k_m.gguf \
    --threads $(nproc) \
    --n-gpu-layers 24 \
    --ctx-size 8192 \
    --cache-type-k q8_0 \
    --port 8080
  ```

### 2.4. Dependencies & Prerequisites for Project 2
- C++17 compiler (GCC / Clang / MSVC) and CMake build toolchain.
- Pre-quantized GGUF model repository (Hugging Face / ggml-org).
- Fast SSD storage (NVMe recommended) to minimize tensor loading latency into system memory.

### 2.5. Risks & Practical Next Steps
- *Risk 1: Thermal Throttling on Laptops.* Sustained CPU inference at 100% core utilization generates substantial heat and reduces token throughput.
  - *Mitigation:* Cap default thread count to `logical_cores - 1` and utilize batch processing pauses.
- *Risk 2: Out-Of-Memory (OOM) Crashes during Long Context Windows.* As conversational history grows, KV cache memory scales linearly and can push systems over available physical RAM.
  - *Mitigation:* Enforce hard context window caps (e.g. 4096 tokens) in the Project 1 estimator interface.
- *Next Step:* Package pre-compiled `llama.cpp` server binaries alongside an automated GGUF model downloader script that interfaces directly with Project 1's `/api/models` endpoint.

---

## 3. Supporting Project 3: Company Knowledge Chatbot Builder

### 3.1. Strategic Objective
Project 3 focuses on enabling non-technical enterprise administrators to ingest proprietary corporate documentation (PDFs, Notion exports, Word documents, internal wikis), construct vector indices, and deploy privacy-compliant conversational chatbots grounded in enterprise knowledge.

### 3.2. Architectural Contributions from Project 1
1. **Unified Generation Interface (`POST /api/chat`):** The chatbot application code calls a single, immutable endpoint. Switching between Google Gemini (for high-volume public inquiries) and local Ollama/llama.cpp (for confidential HR/financial records) requires zero modifications to the chatbot's prompt or RAG retrieval code.
2. **Provider Routing & Privacy Isolation:** Project 1's architecture allows Project 3 to implement an intelligent **Privacy Router**:
   - *Public Knowledge Inquiries:* Routed to **Google Gemini 2.5 Flash** (high speed, 1M token context, zero cost on free tier).
   - *Confidential / Proprietary Corporate Inquiries:* Routed to **Local Ollama (`llama3.2:3b` or `qwen2.5-coder:7b`)**, guaranteeing that internal documents never leave the local corporate network.
3. **Environment Security Architecture:** Project 1's strict separation between `.env` and client JavaScript ensures that enterprise credentials remain isolated from end users interacting with the chatbot UI.

### 3.3. Recommended Technical Architecture for Project 3
- **RAG Orchestration:** Lightweight Retrieval-Augmented Generation pipeline using **LangChain** or **LlamaIndex** with chunking strategies optimized for internal policy manuals (512-token chunks with 64-token overlap).
- **Embedding Generation:**
  - *Local Route:* `all-MiniLM-L6-v2` or `nomic-embed-text` executed locally via Ollama embeddings endpoint (`/api/embeddings`).
  - *Cloud Route:* Google Generative Language `text-embedding-004`.
- **Vector Database:** Embedded vector store (**ChromaDB** or **LanceDB**) running in-process to avoid complex database server setup.
- **Frontend Chat Widget:** Embeddable React chat widget built with the same shadcn/ui components established in Project 1.

### 3.4. Dependencies & Prerequisites for Project 3
- Python RAG libraries: `chromadb`, `sentence-transformers`, `pypdf`, `python-docx`.
- Persistent local vector index storage directory.
- Model Gateway FastAPI backend as the upstream LLM provider.

### 3.5. Risks & Practical Next Steps
- *Risk 1: Cloud Data Leakage of Proprietary Documents.* Submitting confidential company knowledge to public free-tier APIs (e.g., Google AI Studio free tier) violates confidentiality obligations because prompts may be reviewed by human trainers.
  - *Mitigation:* Hardcode a strict "Enterprise Mode" switch that forces all RAG generation requests through local providers (Ollama or llama.cpp).
- *Risk 2: Hallucination in Policy Responses.* Language models may invent company policies when retrieval quality is low.
  - *Mitigation:* Enforce system prompts requiring the model to cite specific document chunks and respond *"The provided documents do not contain information regarding this policy"* when cosine similarity is below threshold.
- *Next Step:* Build the document ingestion pipeline in Project 3 that reads files, generates embeddings, and passes user questions + retrieved context directly into Project 1's `POST /api/chat` endpoint.

---

## 4. Implementation Phasing Roadmap

```
PHASE 1 (COMPLETED — PROJECT 1)
  [x] FastAPI Gateway Core (main.py)
  [x] React + Vite + TypeScript + shadcn/ui Dashboard
  [x] Working Provider Adapters (Gemini, OpenAI, Qwen, Custom, Ollama, llama.cpp)
  [x] Live 2-Provider Verification (Gemini Cloud + Ollama Local)
  [x] Native Hardware Sizing Engine (/api/estimator/calculate)
  [x] Full Technical Audits and Security Documentation

PHASE 2 (NEXT — PROJECT 2: LIGHTWEIGHT ENGINE)
  [ ] Deploy precompiled llama-server with GGUF K-quants (Q4_K_M, Q5_K_M)
  [ ] Implement automatic layer-offload calculation based on Project 1 telemetry
  [ ] Benchmark tokens/second across CPU-only and partial VRAM offload
  [ ] Optimize quantized KV cache (Q8_0) for long conversational context

PHASE 3 (FOLLOW-UP — PROJECT 3: KNOWLEDGE CHATBOT)
  [ ] Build document chunking & vector indexing (ChromaDB + nomic-embed-text)
  [ ] Connect RAG query pipeline directly to Project 1's POST /api/chat
  [ ] Configure Privacy Gate routing confidential documents to local Ollama
  [ ] Deliver embeddable React customer support and internal wiki widget
```

