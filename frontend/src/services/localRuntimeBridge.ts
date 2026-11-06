import type {
  ModelsResponse,
  TestProviderResponse,
  ChatRequestPayload,
  ChatResponsePayload,
} from '@/types'

export type LocalRuntimeStatus = 'connected' | 'offline' | 'cors_blocked' | 'error'

export interface LocalRuntimeCheckResult {
  status: LocalRuntimeStatus
  provider: 'ollama' | 'llamacpp'
  url: string
  models: string[]
  message: string
  errorDetail?: string
  corsFixRequired?: boolean
}

export interface LocalSetupGuide {
  title: string
  description: string
  defaultUrl: string
  quickStartCommands: {
    label: string
    command: string
  }[]
  corsInstructions: {
    platform: string
    description: string
    command?: string
  }[]
  downloadUrl: string
}

const STORAGE_KEY_OLLAMA = 'model_gateway_ollama_endpoint'
const STORAGE_KEY_LLAMACPP = 'model_gateway_llamacpp_endpoint'

export const DEFAULT_OLLAMA_URL = 'http://127.0.0.1:11434'
export const DEFAULT_LLAMACPP_URL = 'http://127.0.0.1:8080'

function normalizeUrl(url: string | undefined | null, defaultUrl: string): string {
  if (!url || !url.trim()) return defaultUrl
  let clean = url.trim().replace(/\/+$/, '')
  if (!/^https?:\/\//i.test(clean)) {
    clean = `http://${clean}`
  }
  return clean
}

export const localRuntimeBridge = {
  // --------------------------------------------------------------------------
  // Endpoint URL Management
  // --------------------------------------------------------------------------
  getOllamaUrl(): string {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_OLLAMA)
      if (saved) return normalizeUrl(saved, DEFAULT_OLLAMA_URL)
    } catch {}
    return DEFAULT_OLLAMA_URL
  },

  setOllamaUrl(url: string): void {
    try {
      if (!url || !url.trim() || url.trim() === DEFAULT_OLLAMA_URL) {
        localStorage.removeItem(STORAGE_KEY_OLLAMA)
      } else {
        localStorage.setItem(STORAGE_KEY_OLLAMA, normalizeUrl(url, DEFAULT_OLLAMA_URL))
      }
    } catch {}
  },

  getLlamaCppUrl(): string {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_LLAMACPP)
      if (saved) return normalizeUrl(saved, DEFAULT_LLAMACPP_URL)
    } catch {}
    return DEFAULT_LLAMACPP_URL
  },

  setLlamaCppUrl(url: string): void {
    try {
      if (!url || !url.trim() || url.trim() === DEFAULT_LLAMACPP_URL) {
        localStorage.removeItem(STORAGE_KEY_LLAMACPP)
      } else {
        localStorage.setItem(STORAGE_KEY_LLAMACPP, normalizeUrl(url, DEFAULT_LLAMACPP_URL))
      }
    } catch {}
  },

  getProviderUrl(provider: string, customUrl?: string): string {
    if (customUrl && customUrl.trim()) {
      return normalizeUrl(customUrl, provider === 'llamacpp' ? DEFAULT_LLAMACPP_URL : DEFAULT_OLLAMA_URL)
    }
    return provider === 'llamacpp' ? this.getLlamaCppUrl() : this.getOllamaUrl()
  },

  // --------------------------------------------------------------------------
  // Runtime Checks & Discovery (Browser -> Localhost)
  // --------------------------------------------------------------------------
  async checkOllamaStatus(customUrl?: string): Promise<LocalRuntimeCheckResult> {
    const url = this.getProviderUrl('ollama', customUrl)
    const isDeployedOrigin =
      typeof window !== 'undefined' &&
      !window.location.hostname.includes('localhost') &&
      !window.location.hostname.includes('127.0.0.1')

    try {
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 4500)

      const res = await fetch(`${url}/api/tags`, {
        method: 'GET',
        signal: controller.signal,
      })
      clearTimeout(timeoutId)

      if (res.status === 403) {
        return {
          status: 'cors_blocked',
          provider: 'ollama',
          url,
          models: [],
          message:
            'Ollama blocked cross-origin access from this website origin. Configure OLLAMA_ORIGINS="*" to permit browser connections.',
          corsFixRequired: true,
        }
      }

      if (!res.ok) {
        return {
          status: 'error',
          provider: 'ollama',
          url,
          models: [],
          message: `Ollama returned HTTP ${res.status}: ${res.statusText}`,
        }
      }

      const data = await res.json()
      const models: string[] = Array.isArray(data.models)
        ? data.models.map((m: any) => m.name || m.model).filter(Boolean)
        : []

      return {
        status: 'connected',
        provider: 'ollama',
        url,
        models,
        message:
          models.length > 0
            ? `Ollama connected at ${url} (${models.length} model${models.length === 1 ? '' : 's'} installed).`
            : `Ollama daemon reachable at ${url}, but no models are currently installed.`,
      }
    } catch (err: any) {
      const isAbort = err.name === 'AbortError'
      const isFailedFetch = err instanceof TypeError || err.message?.includes('Failed to fetch')

      let detail = err.message || 'Connection failed'
      let isCors = false

      if (isAbort) {
        detail = `Request to ${url} timed out after 4.5 seconds. Verify the Ollama service is active.`
      } else if (isFailedFetch) {
        if (isDeployedOrigin) {
          detail = `Unable to connect to Ollama at ${url}. Ensure Ollama is running and OLLAMA_ORIGINS="*" is set for web browser access.`
          isCors = true
        } else {
          detail = `Unable to reach Ollama at ${url}. Start the service with "ollama serve" in your terminal.`
        }
      }

      return {
        status: isCors ? 'cors_blocked' : 'offline',
        provider: 'ollama',
        url,
        models: [],
        message: detail,
        errorDetail: err.stack || err.message,
        corsFixRequired: isCors,
      }
    }
  },

  async checkLlamaCppStatus(customUrl?: string): Promise<LocalRuntimeCheckResult> {
    const url = this.getProviderUrl('llamacpp', customUrl)

    try {
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 4500)

      const res = await fetch(`${url}/v1/models`, {
        method: 'GET',
        signal: controller.signal,
      })
      clearTimeout(timeoutId)

      if (!res.ok) {
        return {
          status: 'error',
          provider: 'llamacpp',
          url,
          models: [],
          message: `llama.cpp server returned HTTP ${res.status}: ${res.statusText}`,
        }
      }

      const data = await res.json()
      let models: string[] = []
      if (Array.isArray(data.data)) {
        models = data.data.map((m: any) => m.id).filter(Boolean)
      }
      if (models.length === 0) {
        models = ['default']
      }

      return {
        status: 'connected',
        provider: 'llamacpp',
        url,
        models,
        message: `llama.cpp server active at ${url} (model: ${models[0]}).`,
      }
    } catch (err: any) {
      const isAbort = err.name === 'AbortError'
      let detail = err.message || 'Connection failed'
      if (isAbort) {
        detail = `Request to ${url} timed out after 4.5 seconds. Check if llama-server is running.`
      } else {
        detail = `llama.cpp server is unreachable at ${url}. Start it with "llama-server -m <model.gguf> --port 8080".`
      }

      return {
        status: 'offline',
        provider: 'llamacpp',
        url,
        models: [],
        message: detail,
        errorDetail: err.stack || err.message,
      }
    }
  },

  // --------------------------------------------------------------------------
  // Unified Provider Listing & Discovery
  // --------------------------------------------------------------------------
  async getModels(provider: string, customUrl?: string): Promise<ModelsResponse> {
    if (provider === 'llamacpp') {
      const result = await this.checkLlamaCppStatus(customUrl)
      if (result.status === 'connected') {
        return {
          models: result.models,
          source: 'runtime',
          notice: null,
        }
      }
      return {
        models: [],
        source: 'runtime',
        notice: result.message,
      }
    }

    // Default to Ollama
    const result = await this.checkOllamaStatus(customUrl)
    if (result.status === 'connected') {
      if (result.models.length === 0) {
        return {
          models: [],
          source: 'runtime',
          notice: `Ollama is running at ${result.url}, but has 0 models installed. Run "ollama pull llama3.2:1b" in your terminal.`,
        }
      }
      return {
        models: result.models,
        source: 'runtime',
        notice: null,
      }
    }

    return {
      models: [],
      source: 'runtime',
      notice: result.message,
    }
  },

  // --------------------------------------------------------------------------
  // Connection Test
  // --------------------------------------------------------------------------
  async testConnection(provider: string, customUrl?: string): Promise<TestProviderResponse> {
    if (provider === 'llamacpp') {
      const result = await this.checkLlamaCppStatus(customUrl)
      if (result.status === 'connected') {
        return {
          status: 'connected',
          provider: 'llamacpp',
          category: 'local',
          message: result.message,
          models: result.models,
        }
      }
      return {
        status: 'error',
        provider: 'llamacpp',
        category: 'local',
        message: result.message,
        models: [],
      }
    }

    // Ollama
    const result = await this.checkOllamaStatus(customUrl)
    if (result.status === 'connected') {
      return {
        status: 'connected',
        provider: 'ollama',
        category: 'local',
        message: result.message,
        models: result.models,
      }
    }
    return {
      status: 'error',
      provider: 'ollama',
      category: 'local',
      message: result.message,
      models: [],
    }
  },

  // --------------------------------------------------------------------------
  // Direct Browser-to-Localhost Chat Execution
  // --------------------------------------------------------------------------
  async sendChat(payload: ChatRequestPayload): Promise<ChatResponsePayload> {
    const { provider, model, message, custom_base_url } = payload

    if (!message || !message.trim()) {
      throw new Error('Message cannot be empty.')
    }
    if (!model || !model.trim()) {
      throw new Error('Please select an installed local model.')
    }

    if (provider === 'llamacpp') {
      const url = this.getProviderUrl('llamacpp', custom_base_url)
      const chatPayload = {
        model: model || 'default',
        messages: [{ role: 'user', content: message.trim() }],
        stream: false,
      }

      let res: Response
      try {
        const controller = new AbortController()
        const timeoutId = setTimeout(() => controller.abort(), 180000) // 3 min timeout for local CPU/GPU infer

        res = await fetch(`${url}/v1/chat/completions`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(chatPayload),
          signal: controller.signal,
        })
        clearTimeout(timeoutId)
      } catch (err: any) {
        if (err.name === 'AbortError') {
          throw new Error(`llama.cpp chat generation timed out after 180s.`)
        }
        throw new Error(
          `Failed to connect to llama.cpp server at ${url}. Verify "llama-server" is active in your terminal.`
        )
      }

      if (!res.ok) {
        let errText = `HTTP ${res.status}`
        try {
          const errJson = await res.json()
          if (errJson.error?.message) errText = errJson.error.message
        } catch {}
        throw new Error(`llama.cpp server error: ${errText}`)
      }

      const data = await res.json()
      const content = data.choices?.[0]?.message?.content
      if (typeof content !== 'string') {
        throw new Error('llama.cpp server returned an invalid or empty response structure.')
      }

      return {
        response: content,
        provider: 'llamacpp',
        category: 'local',
        model,
      }
    }

    // Default: Ollama
    const url = this.getProviderUrl('ollama', custom_base_url)
    const chatPayload = {
      model: model.trim(),
      messages: [{ role: 'user', content: message.trim() }],
      stream: false,
    }

    let res: Response
    try {
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 180000)

      res = await fetch(`${url}/api/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(chatPayload),
        signal: controller.signal,
      })
      clearTimeout(timeoutId)
    } catch (err: any) {
      if (err.name === 'AbortError') {
        throw new Error(`Ollama chat request timed out after 180s. Model may be loading into memory.`)
      }
      throw new Error(
        `Failed to reach Ollama at ${url}. Ensure Ollama is running and cross-origin access (OLLAMA_ORIGINS="*") is configured.`
      )
    }

    if (res.status === 403) {
      throw new Error(
        `Ollama rejected request (HTTP 403). Configure OLLAMA_ORIGINS="*" in your environment to permit web access.`
      )
    }

    if (!res.ok) {
      let errText = `HTTP ${res.status}`
      try {
        const errJson = await res.json()
        if (errJson.error) errText = errJson.error
      } catch {}
      throw new Error(`Ollama error: ${errText}`)
    }

    const data = await res.json()
    const content = data.message?.content
    if (typeof content !== 'string') {
      throw new Error('Ollama returned an unexpected response structure without content.')
    }

    return {
      response: content,
      provider: 'ollama',
      category: 'local',
      model,
    }
  },

  // --------------------------------------------------------------------------
  // Setup Guides & Instructions
  // --------------------------------------------------------------------------
  getSetupGuide(provider: 'ollama' | 'llamacpp'): LocalSetupGuide {
    if (provider === 'llamacpp') {
      return {
        title: 'llama.cpp Server Setup Guide',
        description:
          'llama.cpp enables fast CPU & GPU inference with quantized GGUF models on your local machine.',
        defaultUrl: DEFAULT_LLAMACPP_URL,
        downloadUrl: 'https://github.com/ggml-org/llama.cpp/releases',
        quickStartCommands: [
          {
            label: 'Start server with model file',
            command: 'llama-server -m ./models/qwen2.5-7b-instruct-q4_k_m.gguf --port 8080 -c 4096 --host 127.0.0.1',
          },
          {
            label: 'Start with GPU offload',
            command: 'llama-server -m ./models/model.gguf --port 8080 -ngl 99 --host 127.0.0.1',
          },
        ],
        corsInstructions: [
          {
            platform: 'Cross-Origin Web Access',
            description:
              'llama-server automatically supports CORS requests from standard browsers when running on localhost:8080.',
          },
        ],
      }
    }

    return {
      title: 'Ollama Local Daemon & Web CORS Guide',
      description:
        'Connect directly from this web page to the Ollama service running on your own computer.',
      defaultUrl: DEFAULT_OLLAMA_URL,
      downloadUrl: 'https://ollama.com/download',
      quickStartCommands: [
        {
          label: 'Start Ollama service',
          command: 'ollama serve',
        },
        {
          label: 'Pull lightweight 1B model',
          command: 'ollama pull llama3.2:1b',
        },
        {
          label: 'Pull coding assistant model',
          command: 'ollama pull qwen2.5-coder:7b',
        },
      ],
      corsInstructions: [
        {
          platform: 'Windows (Permanent via System Settings)',
          description:
            '1. Open Start menu and search for "Environment Variables".\n2. Under User Variables, click "New".\n3. Variable name: OLLAMA_ORIGINS | Variable value: *\n4. Exit Ollama from the Windows Taskbar tray, then relaunch it.',
          command: 'setx OLLAMA_ORIGINS "*"',
        },
        {
          platform: 'macOS (Terminal)',
          description: 'Set launchctl environment variable and restart Ollama:',
          command: 'launchctl setenv OLLAMA_ORIGINS "*"',
        },
        {
          platform: 'Linux (systemd)',
          description: 'Add Environment="OLLAMA_ORIGINS=*" to the systemd service file:',
          command: 'sudo systemctl edit ollama.service\n# Add:\n# [Service]\n# Environment="OLLAMA_ORIGINS=*"\nsudo systemctl restart ollama',
        },
      ],
    }
  },
}

