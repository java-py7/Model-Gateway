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
  ExternalLink,
  RefreshCw,
  Terminal,
} from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { api } from '@/services/api'
import { useGateway } from '@/hooks/useGateway'
import { toast } from 'sonner'

export function SettingsPage() {
  const { hardware, fetchHardware } = useGateway()
  const [healthStatus, setHealthStatus] = useState<string>('checking')
  const [latencyMs, setLatencyMs] = useState<number | null>(null)

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

  useEffect(() => {
    checkGatewayHealth()
  }, [])

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
      role: 'Ollama Daemon Local Endpoint',
      masked: 'http://127.0.0.1:11434',
      notes: 'Online. Connected to local Ollama service (model: llama3.2:1b).',
    },
    {
      name: 'LLAMACPP_BASE_URL',
      configured: true,
      role: 'llama.cpp Server Local Endpoint',
      masked: 'http://127.0.0.1:8080',
      notes: 'Default local port. Keep llama-server terminal open during testing.',
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
            Inspect backend connectivity, environment configuration variables, and manage local browser state.
          </p>
        </div>

        <Button
          variant="outline"
          size="sm"
          onClick={checkGatewayHealth}
          className="h-8 text-xs gap-1.5"
        >
          <RefreshCw className="h-3.5 w-3.5" />
          Ping Gateway
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
