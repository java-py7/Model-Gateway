export type ProviderCategory = 'cloud' | 'local'

export interface ProviderItem {
  id: string
  name: string
  default_model: string
  configured: boolean
  default_url?: string
  requires_custom_url?: boolean
}

export interface ProviderCategoryData {
  id: ProviderCategory
  name: string
  providers: ProviderItem[]
}

export interface ProvidersResponse {
  categories: ProviderCategoryData[]
}

export interface ModelsResponse {
  models: string[]
  source: 'runtime' | 'discovered' | 'defaults' | 'manual'
  notice: string | null
}

export interface TestProviderRequest {
  category: ProviderCategory
  provider: string
  model?: string
  custom_base_url?: string
}

export interface TestProviderResponse {
  status: 'connected' | 'error'
  provider: string
  category: ProviderCategory
  message: string
  models: string[]
}

export interface ChatRequestPayload {
  category: ProviderCategory
  provider: string
  model: string
  message: string
  custom_base_url?: string
}

export interface ChatResponsePayload {
  response: string
  provider: string
  category: ProviderCategory
  model: string
}

export interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: number
  provider?: string
  providerName?: string
  model?: string
  category?: ProviderCategory
  error?: boolean
  errorDetail?: string
}

export interface Conversation {
  id: string
  title: string
  category: ProviderCategory
  provider: string
  model: string
  custom_base_url?: string
  created: number
  updated: number
  messages: ChatMessage[]
}

export interface SystemHardware {
  os: {
    system: string
    release: string
    version: string
    platform: string
    python_version: string
  }
  cpu: {
    processor: string
    machine: string
    logical_cores: number
  }
  ram: {
    total_gb: number
    available_gb: number
    used_gb: number
    load_percent: number
  }
  gpu: {
    name: string
    vram_gb: number
    driver_version: string
    detected: boolean
  }
  llmfit: {
    installed: boolean
    path: string | null
    role: string
    notice: string
  }
  runtimes: {
    ollama: {
      url: string
      online: boolean
      status: string
    }
    llamacpp: {
      url: string
      online: boolean
      status: string
    }
  }
}

export interface ModelComparisonItem {
  id: string
  name: string
  provider: string
  provider_name: string
  category: ProviderCategory
  context_window: number
  context_window_display: string
  input_modalities: string[]
  output_modalities: string[]
  streaming: boolean
  tool_calling: boolean
  structured_output: boolean
  free_tier: string
  rate_limits: string
  license: string
  license_type: string
  status: 'verified' | 'documented' | 'unverified'
  verification_note: string
}

export interface ResourceEstimateResult {
  parameters_billion: number
  quantization: string
  context_length: number
  kv_cache_quant: string
  weights_memory_gb: number
  kv_cache_memory_gb: number
  activation_overhead_gb: number
  total_required_gb: number
  host_ram_available_gb: number
  host_ram_total_gb: number
  host_gpu_vram_gb: number
  compatibility: string
  compatibility_badge: 'success' | 'warning' | 'info' | 'destructive'
  recommended_llama_gpu_layers: number
  recommended_command: string
  explanation: string
  disclaimer: string
}

export interface ResearchItem {
  id: string
  name: string
  category: string
  repository: string
  official_site: string
  license: string
  license_type: string
  dependencies: string[]
  security_policy: string
  maintenance_status: string
  integration_relevance: string
  key_findings: string
}

