import type {
  ChatRequestPayload,
  ChatResponsePayload,
  ModelComparisonItem,
  ModelsResponse,
  ProvidersResponse,
  ResearchItem,
  ResourceEstimateResult,
  SystemHardware,
  TestProviderRequest,
  TestProviderResponse,
} from '@/types'

// If frontend is served by FastAPI on port 8000, relative paths work directly.
// If running in Vite dev mode on port 5173, point to backend at 127.0.0.1:8000.
const API_BASE =
  import.meta.env.VITE_API_BASE_URL ||
  (typeof window !== 'undefined' && window.location.port === '5173'
    ? 'http://127.0.0.1:8000'
    : '')

async function handleResponse<T>(res: Response): Promise<T> {
  if (!res.ok) {
    let errorDetail = `Request failed with HTTP ${res.status}`
    try {
      const data = await res.json()
      if (data && data.detail) {
        errorDetail = data.detail
      }
    } catch {
      // response wasn't JSON
    }
    throw new Error(errorDetail)
  }
  return res.json() as Promise<T>
}

export const api = {
  getBaseUrl(): string {
    return API_BASE || window.location.origin
  },

  async getHealth(): Promise<{ status: string; application: string; version: string }> {
    const res = await fetch(`${API_BASE}/api/health`)
    return handleResponse(res)
  },

  async getProviders(): Promise<ProvidersResponse> {
    const res = await fetch(`${API_BASE}/api/providers`)
    return handleResponse(res)
  },

  async getModels(
    category: string,
    provider: string,
    customBaseUrl?: string
  ): Promise<ModelsResponse> {
    const params = new URLSearchParams({
      category,
      provider,
    })
    if (customBaseUrl) {
      params.append('custom_base_url', customBaseUrl)
    }
    const res = await fetch(`${API_BASE}/api/models?${params.toString()}`)
    return handleResponse(res)
  },

  async testProvider(payload: TestProviderRequest): Promise<TestProviderResponse> {
    const res = await fetch(`${API_BASE}/api/providers/test`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    return handleResponse(res)
  },

  async sendChat(payload: ChatRequestPayload): Promise<ChatResponsePayload> {
    const res = await fetch(`${API_BASE}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    return handleResponse(res)
  },

  async getHardware(): Promise<SystemHardware> {
    const res = await fetch(`${API_BASE}/api/hardware`)
    return handleResponse(res)
  },

  async getModelComparison(): Promise<{
    models: ModelComparisonItem[]
    total: number
    categories: string[]
  }> {
    const res = await fetch(`${API_BASE}/api/models/comparison`)
    return handleResponse(res)
  },

  async calculateResourceEstimate(payload: {
    parameters_billion: number
    quantization: string
    context_length: number
    kv_cache_quant?: string
  }): Promise<ResourceEstimateResult> {
    const res = await fetch(`${API_BASE}/api/estimator/calculate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    return handleResponse(res)
  },

  async getResearchAudit(): Promise<{
    technologies: ResearchItem[]
    total: number
  }> {
    const res = await fetch(`${API_BASE}/api/research`)
    return handleResponse(res)
  },
}

