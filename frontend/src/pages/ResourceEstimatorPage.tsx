import { useState, useEffect } from 'react'
import {
  Cpu,
  HardDrive,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  HelpCircle,
  Terminal,
  ExternalLink,
  Info,
  Sparkles,
  RefreshCw,
  Copy,
} from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Progress } from '@/components/ui/progress'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { api } from '@/services/api'
import { useGateway } from '@/hooks/useGateway'
import type { ResourceEstimateResult } from '@/types'
import { toast } from 'sonner'

export function ResourceEstimatorPage() {
  const { hardware, fetchHardware } = useGateway()

  // Preset models
  const presets = [
    { label: 'Qwen 3.5 0.8B (Ultra-Lightweight)', params: 0.8, quant: 'Q4_K_M', ctx: 4096 },
    { label: 'Llama 3.2 1B (Tested on Ollama)', params: 1.0, quant: 'Q4_K_M', ctx: 8192 },
    { label: 'Llama 3.2 3B (Edge Standard)', params: 3.0, quant: 'Q4_K_M', ctx: 8192 },
    { label: 'Qwen 2.5 Coder 7B (Code Specialist)', params: 7.0, quant: 'Q4_K_M', ctx: 8192 },
    { label: 'Llama 3 8B (Workstation Standard)', params: 8.0, quant: 'Q4_K_M', ctx: 8192 },
    { label: 'Qwen 2.5 14B (High Reasoning)', params: 14.0, quant: 'Q4_K_M', ctx: 8192 },
    { label: 'Qwen 2.5 32B (Pro Tier)', params: 32.0, quant: 'Q4_K_M', ctx: 16384 },
    { label: 'Llama 3 70B (Server Grade)', params: 70.0, quant: 'Q4_K_M', ctx: 8192 },
  ]

  // Form inputs
  const [paramsBillion, setParamsBillion] = useState<number>(1.0)
  const [quantization, setQuantization] = useState<string>('Q4_K_M')
  const [contextLength, setContextLength] = useState<number>(8192)
  const [kvCacheQuant, setKvCacheQuant] = useState<string>('FP16')

  // Calculation output
  const [result, setResult] = useState<ResourceEstimateResult | null>(null)
  const [loading, setLoading] = useState(false)

  // Trigger calculation
  const calculate = async () => {
    try {
      setLoading(true)
      const data = await api.calculateResourceEstimate({
        parameters_billion: Number(paramsBillion),
        quantization,
        context_length: Number(contextLength),
        kv_cache_quant: kvCacheQuant,
      })
      setResult(data)
    } catch (err: any) {
      toast.error(`Estimation failed: ${err.message}`)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    calculate()
  }, [paramsBillion, quantization, contextLength, kvCacheQuant])

  const handleSelectPreset = (preset: (typeof presets)[0]) => {
    setParamsBillion(preset.params)
    setQuantization(preset.quant)
    setContextLength(preset.ctx)
    toast.info(`Loaded preset: ${preset.label}`)
  }

  const hostTotalRam = hardware?.ram?.total_gb || 16.0
  const hostAvailRam = hardware?.ram?.available_gb || 6.3
  const hostGpuVram = hardware?.gpu?.vram_gb || 0.0

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between pb-2 border-b border-border">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-foreground flex items-center gap-2">
            Local Model Resource Estimator
            <Badge variant="outline" className="text-[10px]">
              Hardware Sizing Engine
            </Badge>
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Estimate RAM, VRAM, and KV cache requirements before downloading or executing local open-weight models.
          </p>
        </div>

        <Button
          variant="outline"
          size="sm"
          onClick={() => fetchHardware()}
          className="h-8 text-xs gap-1.5"
        >
          <RefreshCw className="h-3.5 w-3.5" />
          Re-inspect Host
        </Button>
      </div>

      {/* Host Hardware Overview Tile */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="bg-card/70 border-border shadow-xs">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground">Host Processor</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-sm font-bold truncate" title={hardware?.cpu?.processor}>
              {hardware?.cpu?.processor || 'x86_64 CPU'}
            </div>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              {hardware?.cpu?.logical_cores || 4} Logical Cores Available
            </p>
          </CardContent>
        </Card>

        <Card className="bg-card/70 border-border shadow-xs">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground">Physical Host RAM</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-xl font-bold">{hostTotalRam} GB Total</div>
            <p className="text-[11px] text-emerald-400 mt-0.5 font-medium">
              {hostAvailRam} GB Available / Free
            </p>
          </CardContent>
        </Card>

        <Card className="bg-card/70 border-border shadow-xs">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground">Graphics Accelerator (GPU)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-sm font-bold truncate" title={hardware?.gpu?.name}>
              {hardware?.gpu?.name || 'Integrated Graphics'}
            </div>
            <p className="text-[11px] text-primary font-medium mt-0.5">
              {hostGpuVram > 0 ? `${hostGpuVram} GB Dedicated VRAM` : 'Shared Host Memory'}
            </p>
          </CardContent>
        </Card>

        <Card className="bg-card/70 border-border shadow-xs">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground">llmfit CLI Integration</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-1.5">
              {hardware?.llmfit?.installed ? (
                <Badge variant="success" className="text-[10px]">
                  CLI Detected
                </Badge>
              ) : (
                <Badge variant="secondary" className="text-[10px]">
                  Not on PATH
                </Badge>
              )}
            </div>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              Native sizing formulas active
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Main Estimator Section: Controls & Output */}
      <div className="grid gap-6 lg:grid-cols-12">
        {/* Left Column: Sizing Parameters (5 cols) */}
        <div className="lg:col-span-5 space-y-4">
          <Card className="bg-card/70 border-border shadow-xs">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold flex items-center justify-between">
                <span>Model Parameters</span>
                <Sparkles className="h-4 w-4 text-primary" />
              </CardTitle>
              <CardDescription className="text-xs">
                Select a standard model preset or configure parameters manually.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 text-xs">
              {/* Presets Dropdown */}
              <div className="space-y-1.5">
                <label className="font-semibold text-foreground">Standard Architecture Presets</label>
                <div className="grid grid-cols-2 gap-1.5">
                  {presets.slice(0, 6).map((preset, idx) => (
                    <Button
                      key={idx}
                      variant="outline"
                      size="sm"
                      onClick={() => handleSelectPreset(preset)}
                      className={`h-auto py-1.5 px-2 text-left justify-start text-[11px] truncate ${
                        paramsBillion === preset.params ? 'border-primary bg-primary/10 text-primary' : ''
                      }`}
                    >
                      {preset.params}B ({preset.quant})
                    </Button>
                  ))}
                </div>
              </div>

              {/* Custom Parameter Size (Billion) */}
              <div className="space-y-1.5">
                <div className="flex justify-between">
                  <label className="font-semibold text-foreground">Active Parameters (Billions):</label>
                  <span className="font-mono text-primary font-bold">{paramsBillion}B</span>
                </div>
                <Input
                  type="number"
                  min="0.1"
                  max="140"
                  step="0.1"
                  value={paramsBillion}
                  onChange={e => setParamsBillion(parseFloat(e.target.value) || 0.1)}
                  className="h-8 font-mono text-xs"
                />
              </div>

              {/* Quantization Format */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="font-semibold text-foreground">Quantization Format (GGUF):</label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <button className="text-muted-foreground hover:text-foreground text-[10px] flex items-center gap-1 cursor-pointer">
                        <HelpCircle className="h-3 w-3 text-primary" />
                        <span>Bits Guide</span>
                      </button>
                    </PopoverTrigger>
                    <PopoverContent className="w-80 p-3 text-xs space-y-2 bg-card border-border shadow-md">
                      <div className="font-semibold text-foreground flex items-center gap-1.5">
                        <Info className="h-3.5 w-3.5 text-primary" />
                        Quantization Bit Allocation
                      </div>
                      <p className="text-[11px] text-muted-foreground leading-relaxed">
                        Quantization reduces parameter bitwidth from 16-bit float (FP16) to 4-bit or 8-bit integers.
                        Q4_K_M uses ~4.5 bits/weight, reducing RAM footprint by ~70% with negligible loss in benchmark perplexity.
                      </p>
                    </PopoverContent>
                  </Popover>
                </div>
                <Select value={quantization} onValueChange={setQuantization}>
                  <SelectTrigger className="h-8 text-xs bg-background">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="FP16">FP16 (16.0 bits/weight — Full Precision)</SelectItem>
                    <SelectItem value="Q8_0">Q8_0 (8.5 bits/weight — High Quality)</SelectItem>
                    <SelectItem value="Q6_K">Q6_K (6.6 bits/weight — Near Lossless)</SelectItem>
                    <SelectItem value="Q5_K_M">Q5_K_M (5.5 bits/weight — High Efficiency)</SelectItem>
                    <SelectItem value="Q4_K_M">Q4_K_M (4.5 bits/weight — Balanced Standard)</SelectItem>
                    <SelectItem value="Q3_K_M">Q3_K_M (3.5 bits/weight — Low Memory)</SelectItem>
                    <SelectItem value="Q2_K">Q2_K (2.7 bits/weight — Extreme Quantization)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Context Length */}
              <div className="space-y-1.5">
                <label className="font-semibold text-foreground">Context Window (Tokens):</label>
                <Select
                  value={String(contextLength)}
                  onValueChange={val => setContextLength(parseInt(val, 10))}
                >
                  <SelectTrigger className="h-8 text-xs bg-background">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="2048">2,048 tokens (2k)</SelectItem>
                    <SelectItem value="4096">4,096 tokens (4k — Standard llama-server)</SelectItem>
                    <SelectItem value="8192">8,192 tokens (8k — Ollama default)</SelectItem>
                    <SelectItem value="16384">16,384 tokens (16k)</SelectItem>
                    <SelectItem value="32768">32,768 tokens (32k)</SelectItem>
                    <SelectItem value="65536">65,536 tokens (64k)</SelectItem>
                    <SelectItem value="131072">131,072 tokens (128k)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* KV Cache Quantization */}
              <div className="space-y-1.5">
                <label className="font-semibold text-foreground">KV Cache Precision:</label>
                <Select value={kvCacheQuant} onValueChange={setKvCacheQuant}>
                  <SelectTrigger className="h-8 text-xs bg-background">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="FP16">FP16 (Standard 16-bit Cache)</SelectItem>
                    <SelectItem value="Q8_0">Q8_0 (8-bit Quantized KV Cache)</SelectItem>
                    <SelectItem value="Q4_0">Q4_0 (4-bit Quantized KV Cache)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Right Column: Sizing Results & Hardware Verdict (7 cols) */}
        <div className="lg:col-span-7 space-y-4">
          <Card className="bg-card/70 border-border shadow-xs">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-sm font-semibold">Estimated Memory Footprint</CardTitle>
                  <CardDescription className="text-xs">
                    Architecture-based breakdown of weights, context cache, and buffers.
                  </CardDescription>
                </div>
                {result && (
                  <Badge
                    variant={
                      result.compatibility_badge === 'success'
                        ? 'success'
                        : result.compatibility_badge === 'warning'
                        ? 'warning'
                        : result.compatibility_badge === 'destructive'
                        ? 'destructive'
                        : 'secondary'
                    }
                    className="text-xs"
                  >
                    {result.compatibility}
                  </Badge>
                )}
              </div>
            </CardHeader>

            <CardContent className="space-y-4 text-xs">
              {/* Grand Total Requirement */}
              <div className="p-4 rounded-xl border border-border bg-background/50 flex items-center justify-between">
                <div>
                  <div className="text-xs text-muted-foreground uppercase tracking-wider">
                    Total Estimated Memory Required
                  </div>
                  <div className="text-3xl font-extrabold tracking-tight text-foreground mt-0.5">
                    {result?.total_required_gb || 0} <span className="text-base font-normal text-muted-foreground">GB</span>
                  </div>
                </div>

                <div className="text-right">
                  <div className="text-[11px] text-muted-foreground">Host RAM Available:</div>
                  <div className="text-sm font-mono font-bold text-emerald-400">
                    {hostAvailRam} GB <span className="text-muted-foreground font-normal">/ {hostTotalRam} GB</span>
                  </div>
                </div>
              </div>

              {/* Memory Visual Capacity Progress Bar */}
              <div className="space-y-1.5">
                <div className="flex justify-between text-[11px] text-muted-foreground">
                  <span>Relative to Host Physical RAM ({hostTotalRam} GB)</span>
                  <span className="font-mono">
                    {Math.min(100, Math.round(((result?.total_required_gb || 0) / hostTotalRam) * 100))}%
                  </span>
                </div>
                <Progress
                  value={Math.min(100, Math.round(((result?.total_required_gb || 0) / hostTotalRam) * 100))}
                  className="h-2.5 bg-secondary"
                  indicatorColor={
                    (result?.total_required_gb || 0) <= hostAvailRam
                      ? 'bg-emerald-500'
                      : (result?.total_required_gb || 0) <= hostTotalRam
                      ? 'bg-amber-500'
                      : 'bg-destructive'
                  }
                />
              </div>

              {/* Memory Breakdown Components */}
              <div className="grid grid-cols-3 gap-2">
                <div className="rounded-lg border border-border p-2.5 bg-background/40">
                  <div className="text-[10px] text-muted-foreground uppercase">Model Weights</div>
                  <div className="text-sm font-mono font-bold text-foreground mt-0.5">
                    {result?.weights_memory_gb || 0} GB
                  </div>
                  <div className="text-[10px] text-muted-foreground">Base parameter file</div>
                </div>

                <div className="rounded-lg border border-border p-2.5 bg-background/40">
                  <div className="text-[10px] text-muted-foreground uppercase">KV Cache</div>
                  <div className="text-sm font-mono font-bold text-foreground mt-0.5">
                    {result?.kv_cache_memory_gb || 0} GB
                  </div>
                  <div className="text-[10px] text-muted-foreground">Context memory</div>
                </div>

                <div className="rounded-lg border border-border p-2.5 bg-background/40">
                  <div className="text-[10px] text-muted-foreground uppercase">Activation & Overhead</div>
                  <div className="text-sm font-mono font-bold text-foreground mt-0.5">
                    {result?.activation_overhead_gb || 0} GB
                  </div>
                  <div className="text-[10px] text-muted-foreground">CUDA / BLAS buffer</div>
                </div>
              </div>

              {/* Recommended Execution Command */}
              <div className="space-y-1.5 pt-1">
                <div className="flex items-center justify-between text-[11px] font-semibold text-foreground">
                  <span className="flex items-center gap-1.5">
                    <Terminal className="h-3.5 w-3.5 text-primary" />
                    Recommended llama.cpp Execution Command
                  </span>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      if (result?.recommended_command) {
                        navigator.clipboard.writeText(result.recommended_command)
                        toast.success('Command copied to clipboard.')
                      }
                    }}
                    className="h-6 px-2 text-[10px]"
                  >
                    <Copy className="h-3 w-3 mr-1" />
                    Copy Command
                  </Button>
                </div>
                <pre className="rounded-lg border border-border bg-zinc-950 p-2.5 font-mono text-[11px] text-zinc-200 overflow-x-auto">
                  <code>{result?.recommended_command}</code>
                </pre>
              </div>

              {/* Hardware Sizing Explanation Alert */}
              <Alert className="py-2.5 bg-background/60 border-border">
                <Info className="h-4 w-4 text-primary" />
                <AlertDescription className="text-[11px] leading-relaxed">
                  <strong>Hardware Compatibility Note:</strong> {result?.explanation}
                </AlertDescription>
              </Alert>

              <div className="text-[10px] text-muted-foreground italic">
                * {result?.disclaimer}
              </div>
            </CardContent>
          </Card>

          {/* llmfit Investigation & Research Card */}
          <Card className="bg-card/70 border-border shadow-xs">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                  <Info className="h-3.5 w-3.5 text-primary" />
                  llmfit Integration & Technical Investigation
                </CardTitle>
                <a
                  href="https://github.com/AlexsJones/llmfit"
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-1 text-[11px] text-primary hover:underline"
                >
                  GitHub Repository
                  <ExternalLink className="h-3 w-3" />
                </a>
              </div>
            </CardHeader>
            <CardContent className="space-y-2 text-xs">
              <p className="text-muted-foreground leading-relaxed text-[11px]">
                <strong>Role & Purpose:</strong> <code>llmfit</code> (created by Alex Jones, MIT License) is an open-source hardware-aware model sizing utility. It inspects local system memory, CPU architecture, and GPU VRAM to calculate whether specific parameter sizes and GGUF quantizations will fit on the machine.
              </p>
              <div className="rounded border border-border p-2 bg-background/50 space-y-1 text-[11px]">
                <div className="font-semibold text-foreground">Key Technical Findings:</div>
                <ul className="list-disc list-inside space-y-0.5 text-muted-foreground">
                  <li>
                    <strong>Not an inference server:</strong> <code>llmfit</code> is a hardware recommendation aid, not a model execution runtime like <code>llama.cpp</code> or <code>Ollama</code>.
                  </li>
                  <li>
                    <strong>Host Status:</strong> {hardware?.llmfit?.notice}
                  </li>
                  <li>
                    <strong>Native Gateway Implementation:</strong> Model Gateway embeds these exact architecture formulas natively in <code>main.py</code>, ensuring zero external CLI dependency is required for full resource estimation functionality.
                  </li>
                </ul>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}

