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
import { localRuntimeBridge } from './localRuntimeBridge'

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
    return API_BASE || (typeof window !== 'undefined' ? window.location.origin : '')
  },

  async getHealth(): Promise<{ status: string; application: string; version: string }> {
    const res = await fetch(`${API_BASE}/api/health`)
    return handleResponse(res)
  },

  async getProviders(): Promise<ProvidersResponse> {
    const res = await fetch(`${API_BASE}/api/providers`)
    const data = await handleResponse<ProvidersResponse>(res)
    // Synchronize local endpoints with visitor's custom configuration
    if (data && data.categories) {
      for (const cat of data.categories) {
        if (cat.id === 'local') {
          for (const prov of cat.providers) {
            if (prov.id === 'ollama') {
              prov.default_url = localRuntimeBridge.getOllamaUrl()
            } else if (prov.id === 'llamacpp') {
              prov.default_url = localRuntimeBridge.getLlamaCppUrl()
            }
          }
        }
      }
    }
    return data
  },

  async getModels(
    category: string,
    provider: string,
    customBaseUrl?: string
  ): Promise<ModelsResponse> {
    // Local providers connect directly from the browser to visitor's localhost
    if (category === 'local') {
      return localRuntimeBridge.getModels(provider, customBaseUrl)
    }

    // Cloud providers query FastAPI on Render with server-side API keys
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
    // Local providers test connectivity directly from visitor's browser to local port
    if (payload.category === 'local') {
      return localRuntimeBridge.testConnection(payload.provider, payload.custom_base_url)
    }

    // Cloud providers test connectivity via FastAPI on Render
    const res = await fetch(`${API_BASE}/api/providers/test`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    return handleResponse(res)
  },

  async sendChat(payload: ChatRequestPayload): Promise<ChatResponsePayload> {
    // Local providers execute chat directly in the browser against visitor's localhost
    if (payload.category === 'local') {
      return localRuntimeBridge.sendChat(payload)
    }

    // Cloud providers route chat via FastAPI on Render
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

export { localRuntimeBridge }
