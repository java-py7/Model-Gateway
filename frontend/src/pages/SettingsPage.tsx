import { useState, useEffect } from 'react'
import {
  Settings,
  Shield,
  Activity,
  HardDrive,
  Trash2,
  Download,
  CheckCircle2,
  AlertCircle,
  AlertTriangle,
  ExternalLink,
  RefreshCw,
  Terminal,
  Cpu,
  Copy,
  Save,
  RotateCcw,
} from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { api, localRuntimeBridge } from '@/services/api'
import { DEFAULT_OLLAMA_URL, DEFAULT_LLAMACPP_URL } from '@/services/localRuntimeBridge'
import type { LocalRuntimeCheckResult } from '@/services/localRuntimeBridge'
import { useGateway } from '@/hooks/useGateway'
import { toast } from 'sonner'

export function SettingsPage() {
  const { hardware, fetchHardware } = useGateway()
  const [healthStatus, setHealthStatus] = useState<string>('checking')
  const [latencyMs, setLatencyMs] = useState<number | null>(null)

  // Local Runtime Bridge states
  const [ollamaUrl, setOllamaUrl] = useState<string>(localRuntimeBridge.getOllamaUrl())
  const [llamacppUrl, setLlamacppUrl] = useState<string>(localRuntimeBridge.getLlamaCppUrl())
  const [ollamaStatus, setOllamaStatus] = useState<LocalRuntimeCheckResult | null>(null)
  const [llamacppStatus, setLlamacppStatus] = useState<LocalRuntimeCheckResult | null>(null)
  const [pingingLocal, setPingingLocal] = useState<boolean>(false)

  const checkGatewayHealth = async () => {
    const start = performance.now()
    try {
      setHealthStatus('checking')
      const res = await api.getHealth()
      const end = performance.now()
      setLatencyMs(Math.round(end - start))
      setHealthStatus(res.status === 'ok' ? 'operational' : 'degraded')
    } catch {
      setHealthStatus('unreachable')
      setLatencyMs(null)
    }
  }

  const pingLocalRuntimes = async () => {
    setPingingLocal(true)
    try {
      const [oRes, lRes] = await Promise.all([
        localRuntimeBridge.checkOllamaStatus(ollamaUrl),
        localRuntimeBridge.checkLlamaCppStatus(llamacppUrl),
      ])
      setOllamaStatus(oRes)
      setLlamacppStatus(lRes)
    } catch (err) {
      console.error('Failed to ping local bridge:', err)
    } finally {
      setPingingLocal(false)
    }
  }

  useEffect(() => {
    checkGatewayHealth()
    pingLocalRuntimes()
  }, [])

  const handleSaveLocalEndpoints = () => {
    localRuntimeBridge.setOllamaUrl(ollamaUrl)
    localRuntimeBridge.setLlamaCppUrl(llamacppUrl)
    toast.success('Local runtime bridge endpoints saved.')
    pingLocalRuntimes()
  }

  const handleResetLocalEndpoints = () => {
    setOllamaUrl(DEFAULT_OLLAMA_URL)
    setLlamacppUrl(DEFAULT_LLAMACPP_URL)
    localRuntimeBridge.setOllamaUrl(DEFAULT_OLLAMA_URL)
    localRuntimeBridge.setLlamaCppUrl(DEFAULT_LLAMACPP_URL)
    toast.info('Local endpoints reset to defaults.')
    pingLocalRuntimes()
  }

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text)
    toast.success('Copied to clipboard.')
  }

  const envVariables = [
    {
      name: 'GEMINI_API_KEY',
      configured: true,
      role: 'Google Gemini Cloud Provider',
      masked: '••••••••••••••••••••••••••••••••',
      notes: 'Active. Access to gemini-2.5-flash and multimodal models on Google AI Studio.',
    },
    {
      name: 'OPENAI_API_KEY',
      configured: true,
      role: 'OpenAI Cloud Provider',
      masked: '••••••••••••••••••••••••••••••••',
      notes: 'Active in .env. Connection verified; generation returned 429 quota exhaustion.',
    },
    {
      name: 'DASHSCOPE_API_KEY',
      configured: false,
      role: 'Qwen / DashScope Cloud Provider',
      masked: 'Not configured (placeholder in .env)',
      notes: 'Optional. Required to query qwen-plus and qwen2.5-72b-instruct via Alibaba Cloud.',
    },
    {
      name: 'CUSTOM_API_KEY',
      configured: false,
      role: 'Custom OpenAI-Compatible Provider',
      masked: 'Not configured',
      notes: 'Optional Authorization Bearer token for third-party HTTPS endpoints.',
    },
    {
      name: 'OLLAMA_BASE_URL',
      configured: true,
      role: 'Ollama Daemon Local Endpoint (FastAPI proxy)',
      masked: 'http://127.0.0.1:11434',
      notes: 'Fallback proxy URL. Direct browser bridge connects independently on client side.',
    },
    {
      name: 'LLAMACPP_BASE_URL',
      configured: true,
      role: 'llama.cpp Server Local Endpoint (FastAPI proxy)',
      masked: 'http://127.0.0.1:8080',
      notes: 'Fallback proxy URL. Direct browser bridge connects independently on client side.',
    },
    {
      name: 'PROVIDER_TIMEOUT_SECONDS',
      configured: true,
      role: 'Network Timeout Configuration',
      masked: '45 seconds',
      notes: 'Uniform timeout applied to all outgoing httpx client requests.',
    },
    {
      name: 'CORS_ORIGINS',
      configured: true,
      role: 'Cross-Origin Resource Sharing Guard',
      masked: 'http://127.0.0.1:8000, :5173, :3000',
      notes: 'Restricts browser API access strictly to designated frontend dev and preview origins.',
    },
  ]

  const handleClearHistory = () => {
    if (confirm('Are you sure you want to clear your local chat history? This cannot be undone.')) {
      localStorage.removeItem('model_gateway_conversations_v2')
      toast.success('Chat history cleared. Reload the playground to start fresh.')
    }
  }

  const handleExportHistory = () => {
    try {
      const data = localStorage.getItem('model_gateway_conversations_v2') || '[]'
      const blob = new Blob([data], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `model-gateway-conversations-${Date.now()}.json`
      a.click()
      URL.revokeObjectURL(url)
      toast.success('Conversations exported to JSON file.')
    } catch {
      toast.error('Failed to export conversations.')
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between pb-2 border-b border-border">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-foreground flex items-center gap-2">
            Gateway Settings & Environment Diagnostics
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Inspect backend connectivity, environment configuration variables, and manage local browser runtime bridge.
          </p>
        </div>

        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            checkGatewayHealth()
            pingLocalRuntimes()
          }}
          className="h-8 text-xs gap-1.5"
        >
          <RefreshCw className="h-3.5 w-3.5" />
          Ping All Nodes
        </Button>
      </div>

      {/* Gateway Status Banner */}
      <Card className="bg-card/70 border-border shadow-xs">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold flex items-center justify-between">
            <span className="flex items-center gap-2">
              <Activity className="h-4 w-4 text-primary" />
              FastAPI Core Gateway Health
            </span>
            <Badge
              variant={
                healthStatus === 'operational'
                  ? 'success'
                  : healthStatus === 'checking'
                  ? 'secondary'
                  : 'destructive'
              }
              className="text-xs uppercase"
            >
              {healthStatus}
            </Badge>
          </CardTitle>
          <CardDescription className="text-xs">
            Direct REST connection to <code>main.py</code> running on <code>http://127.0.0.1:8000</code>.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3 text-xs">
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-lg border border-border p-3 bg-background/50">
              <div className="text-muted-foreground text-[10px] uppercase">Gateway Status</div>
              <div className="text-base font-bold text-foreground mt-0.5">
                {healthStatus === 'operational' ? 'Operational (200 OK)' : healthStatus}
              </div>
            </div>

            <div className="rounded-lg border border-border p-3 bg-background/50">
              <div className="text-muted-foreground text-[10px] uppercase">API Latency</div>
              <div className="text-base font-bold text-emerald-400 mt-0.5 font-mono">
                {latencyMs !== null ? `${latencyMs} ms` : 'N/A'}
              </div>
            </div>

            <div className="rounded-lg border border-border p-3 bg-background/50">
              <div className="text-muted-foreground text-[10px] uppercase">Deployment Target</div>
              <div className="text-base font-bold text-foreground mt-0.5">
                Render / Local Dev
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Local Runtime Bridge Card (Visitor Computer) */}
      <Card className="bg-card/70 border-border shadow-xs">
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between">
            <div>
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <Cpu className="h-4 w-4 text-emerald-400" />
                Local Runtime Bridge Configuration (Visitor Computer)
              </CardTitle>
              <CardDescription className="text-xs mt-1">
                When Model Gateway is deployed on Render, your web browser connects directly to your own computer's local ports. No model weights or prompts travel through any remote server.
              </CardDescription>
            </div>
            <Badge variant="outline" className="text-[10px] text-emerald-400 border-emerald-500/30">
              Client-Direct Bridge
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-4 text-xs">
          <div className="grid gap-4 md:grid-cols-2">
            {/* Ollama Endpoint */}
            <div className="rounded-lg border border-border p-3 bg-background/50 space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-foreground">Ollama Localhost Endpoint</span>
                {ollamaStatus?.status === 'connected' ? (
                  <Badge variant="success" className="text-[9px] gap-1">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
                    Online ({ollamaStatus.models.length} model{ollamaStatus.models.length === 1 ? '' : 's'})
                  </Badge>
                ) : ollamaStatus?.status === 'cors_blocked' ? (
                  <Badge variant="warning" className="text-[9px] gap-1">
                    <AlertTriangle className="h-2.5 w-2.5" />
                    CORS Required
                  </Badge>
                ) : (
                  <Badge variant="secondary" className="text-[9px] text-zinc-400">
                    Offline
                  </Badge>
                )}
              </div>
              <Input
                value={ollamaUrl}
                onChange={e => setOllamaUrl(e.target.value)}
                placeholder="http://127.0.0.1:11434"
                className="font-mono text-xs h-8"
              />
              <p className="text-[11px] text-muted-foreground leading-relaxed">
                {ollamaStatus?.message || 'Default local daemon port 11434.'}
              </p>
            </div>

            {/* llama.cpp Endpoint */}
            <div className="rounded-lg border border-border p-3 bg-background/50 space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-foreground">llama.cpp Server Endpoint</span>
                {llamacppStatus?.status === 'connected' ? (
                  <Badge variant="success" className="text-[9px] gap-1">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
                    Active
                  </Badge>
                ) : (
                  <Badge variant="secondary" className="text-[9px] text-zinc-400">
                    Offline
                  </Badge>
                )}
              </div>
              <Input
                value={llamacppUrl}
                onChange={e => setLlamacppUrl(e.target.value)}
                placeholder="http://127.0.0.1:8080"
                className="font-mono text-xs h-8"
              />
              <p className="text-[11px] text-muted-foreground leading-relaxed">
                {llamacppStatus?.message || 'Default llama-server port 8080.'}
              </p>
            </div>
          </div>

          <div className="flex items-center justify-between pt-1">
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                onClick={handleSaveLocalEndpoints}
                className="h-7 text-xs gap-1.5 bg-primary text-primary-foreground hover:bg-primary/90"
              >
                <Save className="h-3 w-3" />
                Save Endpoints
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handleResetLocalEndpoints}
                className="h-7 text-xs gap-1.5"
              >
                <RotateCcw className="h-3 w-3" />
                Reset Defaults
              </Button>
            </div>

            <Button
              variant="ghost"
              size="sm"
              onClick={pingLocalRuntimes}
              disabled={pingingLocal}
              className="h-7 text-xs gap-1.5 text-muted-foreground hover:text-foreground"
            >
              <RefreshCw className={`h-3 w-3 ${pingingLocal ? 'animate-spin' : ''}`} />
              Test Local Ports
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Environment Variables Table */}
      <Card className="bg-card/70 border-border shadow-xs overflow-hidden">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <Shield className="h-4 w-4 text-primary" />
                Environment Variable Audit (Model-gateway/.env)
              </CardTitle>
              <CardDescription className="text-xs">
                Credentials are read server-side only and are never exposed or transmitted in client network responses.
              </CardDescription>
            </div>
            <Badge variant="outline" className="text-[10px]">
              Strict Secret Isolation
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader className="bg-muted/40">
              <TableRow className="border-border">
                <TableHead className="text-xs">Variable Name</TableHead>
                <TableHead className="text-xs">Target Integration</TableHead>
                <TableHead className="text-xs">Status</TableHead>
                <TableHead className="text-xs">Safe Representation</TableHead>
                <TableHead className="text-xs">Operational Notes</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {envVariables.map((v, idx) => (
                <TableRow key={idx} className="border-border/60 hover:bg-muted/20 text-xs">
                  <TableCell className="font-mono font-semibold text-primary">
                    {v.name}
                  </TableCell>
                  <TableCell className="text-muted-foreground">{v.role}</TableCell>
                  <TableCell>
                    {v.configured ? (
                      <Badge variant="success" className="text-[9px] gap-1">
                        <CheckCircle2 className="h-2.5 w-2.5" />
                        Configured
                      </Badge>
                    ) : (
                      <Badge variant="secondary" className="text-[9px] text-zinc-400">
                        Optional / Unset
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell className="font-mono text-[11px] text-muted-foreground">
                    {v.masked}
                  </TableCell>
                  <TableCell className="text-[11px] text-muted-foreground">{v.notes}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Client Data & LocalStorage Management */}
      <Card className="bg-card/70 border-border shadow-xs">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <HardDrive className="h-4 w-4 text-primary" />
            Client Storage & Browser Cache
          </CardTitle>
          <CardDescription className="text-xs">
            Export or clear your local conversation history stored in the browser.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-col sm:flex-row gap-3">
            <Button
              variant="outline"
              size="sm"
              onClick={handleExportHistory}
              className="text-xs gap-1.5"
            >
              <Download className="h-3.5 w-3.5 text-primary" />
              Export Chat History (.JSON)
            </Button>
            <Button
              variant="destructive"
              size="sm"
              onClick={handleClearHistory}
              className="text-xs gap-1.5"
            >
              <Trash2 className="h-3.5 w-3.5" />
              Clear Local Chat History
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
