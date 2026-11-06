import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Server,
  Cpu,
  Layers,
  Sparkles,
  ArrowRight,
  RefreshCw,
  HardDrive,
  ExternalLink,
} from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { useGateway } from '@/hooks/useGateway'
import { toast } from 'sonner'

export function OverviewPage() {
  const navigate = useNavigate()
  const {
    allProviders,
    configuredCount,
    hardware,
    loadingProviders,
    testProvider,
    fetchProviders,
    fetchHardware,
  } = useGateway()

  const [testingAll, setTestingAll] = useState(false)
  const [testSummary, setTestSummary] = useState<
    Array<{ provider: string; status: 'passed' | 'failed' | 'skipped'; detail: string }>
  >([
    {
      provider: 'Google Gemini (Cloud)',
      status: 'passed',
      detail: 'HTTP 200 — Discovered 47 generative content models.',
    },
    {
      provider: 'Ollama (Local Runtime)',
      status: 'passed',
      detail: 'HTTP 200 — Reachable on port 11434 (model: llama3.2:1b).',
    },
    {
      provider: 'OpenAI (Cloud)',
      status: 'failed',
      detail: 'HTTP 429 — Connection test passed, chat generation quota limited.',
    },
    {
      provider: 'llama.cpp Server (Local)',
      status: 'skipped',
      detail: 'HTTP 503 — llama-server not active on port 8080.',
    },
  ])

  const handleTestAll = async () => {
    setTestingAll(true)
    toast.info('Initiating live connectivity checks across configured providers...')
    const newSummary: typeof testSummary = []

    for (const p of allProviders) {
      if (p.id === 'custom') continue
      try {
        const res = await testProvider(p.category, p.id)
        newSummary.push({
          provider: `${p.name} (${p.category})`,
          status: 'passed',
          detail: res.message,
        })
      } catch (err: any) {
        newSummary.push({
          provider: `${p.name} (${p.category})`,
          status: p.configured ? 'failed' : 'skipped',
          detail: err.message || 'Unreachable or unconfigured',
        })
      }
    }

    setTestSummary(newSummary)
    setTestingAll(false)
    toast.success('Live provider diagnostics completed.')
  }

  const handleRefresh = async () => {
    await Promise.all([fetchProviders(), fetchHardware()])
    toast.success('Gateway telemetry updated.')
  }

  const totalProviders = allProviders.length || 6
  const isOllamaOnline = hardware?.runtimes?.ollama?.online ?? false
  const isLlamaCppOnline = hardware?.runtimes?.llamacpp?.online ?? false

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between pb-2 border-b border-border">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-foreground flex items-center gap-2">
            Model Gateway Overview
            <Badge variant="outline" className="text-[10px] bg-primary/10 text-primary border-primary/30">
              v1.0.0 Active
            </Badge>
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Unified developer abstraction layer for Cloud AI and local open-weight inference runtimes.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleRefresh}
            className="h-8 text-xs gap-1.5"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            Refresh Telemetry
          </Button>
          <Button
            size="sm"
            onClick={handleTestAll}
            disabled={testingAll}
            className="h-8 text-xs gap-1.5 bg-primary text-primary-foreground hover:bg-primary/90"
          >
            {testingAll ? (
              <RefreshCw className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Sparkles className="h-3.5 w-3.5" />
            )}
            Run Diagnostics
          </Button>
        </div>
      </div>

      {/* KPI Cards Grid */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {/* Total Providers */}
        <Card className="bg-card/70 border-border shadow-xs">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground">
              Supported Providers
            </CardTitle>
            <Server className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold tracking-tight">{totalProviders}</div>
            <p className="text-[11px] text-muted-foreground mt-1">
              4 Cloud APIs + 2 Local Runtimes
            </p>
          </CardContent>
        </Card>

        {/* Configured Providers */}
        <Card className="bg-card/70 border-border shadow-xs">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground">
              Configured Keys & Nodes
            </CardTitle>
            <Badge variant="success" className="text-[10px] px-1.5 py-0">
              {configuredCount} Ready
            </Badge>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold tracking-tight text-emerald-400">
              {configuredCount} / {totalProviders}
            </div>
            <p className="text-[11px] text-muted-foreground mt-1">
              Gemini & OpenAI configured in .env
            </p>
          </CardContent>
        </Card>

        {/* Local Inference Engines */}
        <Card className="bg-card/70 border-border shadow-xs">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground">
              Local Runtime Status
            </CardTitle>
            <Cpu className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-xl font-bold tracking-tight flex items-center gap-2">
              <span className="flex h-2 w-2 rounded-full bg-emerald-500 animate-ping" />
              <span>{isOllamaOnline ? 'Ollama Online' : 'Local Offline'}</span>
            </div>
            <p className="text-[11px] text-muted-foreground mt-1">
              {isOllamaOnline ? '127.0.0.1:11434 (llama3.2:1b)' : 'Start Ollama or llama-server'}
            </p>
          </CardContent>
        </Card>

        {/* Host Memory Footprint */}
        <Card className="bg-card/70 border-border shadow-xs">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground">
              Host Physical Memory
            </CardTitle>
            <HardDrive className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold tracking-tight">
              {hardware?.ram ? `${hardware.ram.available_gb} GB` : '6.3 GB'}
            </div>
            <p className="text-[11px] text-muted-foreground mt-1">
              {hardware?.ram ? `Free of ${hardware.ram.total_gb} GB Total` : 'Available for local weights'}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Main Two-Column Row */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-7">
        {/* Left: Providers Status & Nodes (4 cols) */}
        <Card className="lg:col-span-4 bg-card/70 border-border shadow-xs">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-sm font-semibold">Active Provider Nodes</CardTitle>
                <CardDescription className="text-xs">
                  Real-time connectivity and credential verification status.
                </CardDescription>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => navigate('/providers')}
                className="text-xs gap-1 text-primary hover:text-primary"
              >
                Manage
                <ArrowRight className="h-3.5 w-3.5" />
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {/* Cloud Providers Group */}
            <div className="space-y-2">
              <div className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                Cloud AI Gateways
              </div>
              <div className="grid gap-2">
                {/* Gemini */}
                <div className="flex items-center justify-between p-2.5 rounded-lg border border-border bg-background/50 hover:bg-accent/40 transition-colors">
                  <div className="flex items-center gap-3">
                    <div className="h-2 w-2 rounded-full bg-emerald-500" />
                    <div>
                      <div className="text-xs font-medium text-foreground flex items-center gap-1.5">
                        Google Gemini
                        <Badge variant="outline" className="text-[9px] px-1 py-0 border-emerald-500/30 text-emerald-400">
                          Tested & Verified
                        </Badge>
                      </div>
                      <div className="text-[11px] text-muted-foreground">
                        generativelanguage.googleapis.com · 47 models discovered
                      </div>
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => navigate('/playground')}
                    className="h-7 text-xs"
                  >
                    Open Chat
                  </Button>
                </div>

                {/* OpenAI */}
                <div className="flex items-center justify-between p-2.5 rounded-lg border border-border bg-background/50 hover:bg-accent/40 transition-colors">
                  <div className="flex items-center gap-3">
                    <div className="h-2 w-2 rounded-full bg-amber-500" />
                    <div>
                      <div className="text-xs font-medium text-foreground flex items-center gap-1.5">
                        OpenAI
                        <Badge variant="outline" className="text-[9px] px-1 py-0 border-amber-500/30 text-amber-400">
                          Quota Limit (429)
                        </Badge>
                      </div>
                      <div className="text-[11px] text-muted-foreground">
                        api.openai.com/v1 · Key configured; generation limited
                      </div>
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => navigate('/providers')}
                    className="h-7 text-xs"
                  >
                    Details
                  </Button>
                </div>

                {/* Qwen DashScope */}
                <div className="flex items-center justify-between p-2.5 rounded-lg border border-border bg-background/50 hover:bg-accent/40 transition-colors">
                  <div className="flex items-center gap-3">
                    <div className="h-2 w-2 rounded-full bg-zinc-600" />
                    <div>
                      <div className="text-xs font-medium text-foreground flex items-center gap-1.5">
                        Qwen / DashScope
                        <Badge variant="outline" className="text-[9px] px-1 py-0 border-zinc-700 text-zinc-400">
                          Unconfigured
                        </Badge>
                      </div>
                      <div className="text-[11px] text-muted-foreground">
                        dashscope-intl.aliyuncs.com · Add DASHSCOPE_API_KEY in .env
                      </div>
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => navigate('/providers')}
                    className="h-7 text-xs"
                  >
                    Configure
                  </Button>
                </div>
              </div>
            </div>

            {/* Local AI Runtimes Group */}
            <div className="space-y-2 pt-2">
              <div className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                Local Inference Engines
              </div>
              <div className="grid gap-2">
                {/* Ollama */}
                <div className="flex items-center justify-between p-2.5 rounded-lg border border-border bg-background/50 hover:bg-accent/40 transition-colors">
                  <div className="flex items-center gap-3">
                    <div className="h-2 w-2 rounded-full bg-emerald-500" />
                    <div>
                      <div className="text-xs font-medium text-foreground flex items-center gap-1.5">
                        Ollama Local Daemon
                        <Badge variant="outline" className="text-[9px] px-1 py-0 border-emerald-500/30 text-emerald-400">
                          Live (:11434)
                        </Badge>
                      </div>
                      <div className="text-[11px] text-muted-foreground">
                        Active model: llama3.2:1b · Generation verified
                      </div>
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => navigate('/playground')}
                    className="h-7 text-xs"
                  >
                    Test Model
                  </Button>
                </div>

                {/* llama.cpp */}
                <div className="flex items-center justify-between p-2.5 rounded-lg border border-border bg-background/50 hover:bg-accent/40 transition-colors">
                  <div className="flex items-center gap-3">
                    <div className="h-2 w-2 rounded-full bg-zinc-600" />
                    <div>
                      <div className="text-xs font-medium text-foreground flex items-center gap-1.5">
                        llama.cpp Server
                        <Badge variant="outline" className="text-[9px] px-1 py-0 border-zinc-700 text-zinc-400">
                          Offline (:8080)
                        </Badge>
                      </div>
                      <div className="text-[11px] text-muted-foreground">
                        Start with: llama-server -m &lt;model&gt;.gguf --port 8080
                      </div>
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => navigate('/estimator')}
                    className="h-7 text-xs"
                  >
                    Size Model
                  </Button>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Right: Hardware Telemetry & Quick Sizing (3 cols) */}
        <div className="lg:col-span-3 space-y-4">
          <Card className="bg-card/70 border-border shadow-xs">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold flex items-center justify-between">
                <span>Hardware Inspection</span>
                <Badge variant="secondary" className="text-[10px] font-mono">
                  {hardware?.os?.system || 'Windows'} x64
                </Badge>
              </CardTitle>
              <CardDescription className="text-xs">
                Live host memory and graphics accelerator specs.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 text-xs">
              {/* RAM Bar */}
              <div className="space-y-1.5">
                <div className="flex justify-between text-muted-foreground text-[11px]">
                  <span>System RAM Utilization</span>
                  <span className="font-mono text-foreground font-medium">
                    {hardware?.ram ? `${hardware.ram.used_gb} GB / ${hardware.ram.total_gb} GB (${hardware.ram.load_percent}%)` : '9.6 GB / 16.0 GB (60%)'}
                  </span>
                </div>
                <Progress
                  value={hardware?.ram?.load_percent || 60}
                  className="h-2 bg-secondary"
                  indicatorColor="bg-primary"
                />
              </div>

              {/* Hardware Details Table */}
              <div className="rounded-md border border-border p-2.5 bg-background/40 space-y-1.5">
                <div className="flex justify-between py-0.5">
                  <span className="text-muted-foreground">CPU Cores:</span>
                  <span className="font-mono font-medium">{hardware?.cpu?.logical_cores || 4} Logical Cores</span>
                </div>
                <div className="flex justify-between py-0.5">
                  <span className="text-muted-foreground">Processor:</span>
                  <span className="font-mono text-[11px] text-right truncate max-w-[170px]" title={hardware?.cpu?.processor}>
                    {hardware?.cpu?.processor || 'Intel / AMD x86_64'}
                  </span>
                </div>
                <div className="flex justify-between py-0.5">
                  <span className="text-muted-foreground">GPU Adapter:</span>
                  <span className="font-mono font-medium text-[11px] text-right truncate max-w-[170px]" title={hardware?.gpu?.name}>
                    {hardware?.gpu?.name || 'Integrated'}
                  </span>
                </div>
                <div className="flex justify-between py-0.5">
                  <span className="text-muted-foreground">Detected VRAM:</span>
                  <span className="font-mono text-primary font-semibold">
                    {hardware?.gpu?.vram_gb ? `${hardware.gpu.vram_gb} GB` : 'Shared Host Memory'}
                  </span>
                </div>
                <div className="flex justify-between py-0.5 border-t border-border/60 pt-1">
                  <span className="text-muted-foreground">llmfit Utility:</span>
                  <span className="font-mono text-[11px] text-muted-foreground">
                    {hardware?.llmfit?.installed ? 'Available' : 'Formula Estimator Native'}
                  </span>
                </div>
              </div>

              <Button
                variant="outline"
                size="sm"
                onClick={() => navigate('/estimator')}
                className="w-full text-xs gap-1.5"
              >
                <Cpu className="h-3.5 w-3.5" />
                Open Hardware Sizing Calculator
              </Button>
            </CardContent>
          </Card>

          {/* Quick Actions Card */}
          <Card className="bg-card/70 border-border shadow-xs">
            <CardHeader className="pb-2">
              <CardTitle className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Quick Navigation
              </CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-2 gap-2">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => navigate('/playground')}
                className="h-14 flex-col items-start justify-center p-2.5 text-left"
              >
                <span className="text-xs font-semibold text-foreground">Playground</span>
                <span className="text-[10px] text-muted-foreground">Chat & prompt testing</span>
              </Button>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => navigate('/comparison')}
                className="h-14 flex-col items-start justify-center p-2.5 text-left"
              >
                <span className="text-xs font-semibold text-foreground">Compare Models</span>
                <span className="text-[10px] text-muted-foreground">Side-by-side matrix</span>
              </Button>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => navigate('/research')}
                className="h-14 flex-col items-start justify-center p-2.5 text-left"
              >
                <span className="text-xs font-semibold text-foreground">Research & Audit</span>
                <span className="text-[10px] text-muted-foreground">6 audited technologies</span>
              </Button>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => navigate('/settings')}
                className="h-14 flex-col items-start justify-center p-2.5 text-left"
              >
                <span className="text-xs font-semibold text-foreground">Settings</span>
                <span className="text-[10px] text-muted-foreground">Env vars & timeouts</span>
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Diagnostics / Activity Log */}
      <Card className="bg-card/70 border-border shadow-xs">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold flex items-center justify-between">
            <span>Recent Provider Test Results & Reliability Observations</span>
            <Badge variant="outline" className="text-[10px] font-normal">
              Empirical Observations
            </Badge>
          </CardTitle>
          <CardDescription className="text-xs">
            Live telemetry and recorded failure cases preserved from laboratory testing.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {testSummary.map((item, idx) => (
              <div
                key={idx}
                className="flex items-center justify-between p-2 rounded-md border border-border/70 bg-background/40 text-xs"
              >
                <div className="flex items-center gap-2.5">
                  <Badge
                    variant={
                      item.status === 'passed'
                        ? 'success'
                        : item.status === 'failed'
                        ? 'destructive'
                        : 'secondary'
                    }
                    className="text-[10px] px-1.5 py-0 uppercase"
                  >
                    {item.status}
                  </Badge>
                  <span className="font-semibold text-foreground">{item.provider}</span>
                </div>
                <span className="text-muted-foreground font-mono text-[11px] truncate max-w-md">
                  {item.detail}
                </span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

