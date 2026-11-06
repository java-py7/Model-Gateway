import { useState, useEffect } from 'react'
import {
  GitCompare,
  Search,
  Filter,
  Check,
  X,
  HelpCircle,
  Sparkles,
  Layers,
  Shield,
  Zap,
} from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Skeleton } from '@/components/ui/skeleton'
import { api } from '@/services/api'
import type { ModelComparisonItem } from '@/types'

export function ModelComparisonPage() {
  const [models, setModels] = useState<ModelComparisonItem[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [providerFilter, setProviderFilter] = useState('all')
  const [categoryFilter, setCategoryFilter] = useState('all')

  // Selected models for side-by-side comparison (up to 4)
  const [selectedModelIds, setSelectedModelIds] = useState<string[]>([
    'gemini-2.5-flash',
    'llama3.2:1b',
  ])

  useEffect(() => {
    async function loadComparison() {
      try {
        setLoading(true)
        const res = await api.getModelComparison()
        setModels(res.models || [])
      } catch (err) {
        console.error('Failed to load comparison models:', err)
      } finally {
        setLoading(false)
      }
    }
    loadComparison()
  }, [])

  // Filter models
  const filteredModels = models.filter(m => {
    const matchesSearch =
      m.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      m.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
      m.provider_name.toLowerCase().includes(searchQuery.toLowerCase())

    const matchesProvider =
      providerFilter === 'all' || m.provider === providerFilter

    const matchesCategory =
      categoryFilter === 'all' || m.category === categoryFilter

    return matchesSearch && matchesProvider && matchesCategory
  })

  // Toggle selection for side-by-side comparison
  const toggleSelectModel = (id: string) => {
    setSelectedModelIds(prev => {
      if (prev.includes(id)) {
        return prev.filter(item => item !== id)
      }
      if (prev.length >= 4) {
        return [...prev.slice(1), id] // Keep max 4
      }
      return [...prev, id]
    })
  }

  const selectedModels = models.filter(m => selectedModelIds.includes(m.id))

  const renderCheckCross = (val: boolean | string) => {
    if (val === true || val === 'yes' || val === 'Supported') {
      return (
        <span className="inline-flex items-center gap-1 text-emerald-400 font-medium">
          <Check className="h-3.5 w-3.5" />
          Supported
        </span>
      )
    }
    if (val === false || val === 'no' || val === 'Not Supported') {
      return (
        <span className="inline-flex items-center gap-1 text-zinc-500">
          <X className="h-3.5 w-3.5" />
          No
        </span>
      )
    }
    return <span className="text-muted-foreground text-xs">{val || 'Unknown'}</span>
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between pb-2 border-b border-border">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-foreground flex items-center gap-2">
            Model Capability & Architecture Matrix
            <Badge variant="outline" className="text-[10px]">
              Verified & Documented Data
            </Badge>
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Compare context windows, input/output modalities, tool calling, structured JSON output, and license terms.
          </p>
        </div>

        <Badge variant="secondary" className="text-xs">
          Comparing {selectedModelIds.length} / 4 Selected Models
        </Badge>
      </div>

      {/* Side-by-Side Comparison Cards */}
      {selectedModels.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
              <GitCompare className="h-3.5 w-3.5 text-primary" />
              Side-by-Side Model Comparison
            </h3>
            <span className="text-[11px] text-muted-foreground">
              Select or deselect models in the table below to adjust this comparison.
            </span>
          </div>

          <div className={`grid gap-4 sm:grid-cols-2 lg:grid-cols-${Math.min(4, Math.max(2, selectedModels.length))}`}>
            {selectedModels.map(model => (
              <Card key={model.id} className="bg-card border-border shadow-xs flex flex-col justify-between">
                <CardHeader className="pb-3 border-b border-border/60">
                  <div className="flex items-start justify-between">
                    <div>
                      <Badge
                        variant={model.category === 'cloud' ? 'secondary' : 'outline'}
                        className="text-[9px] uppercase mb-1"
                      >
                        {model.category} · {model.provider_name}
                      </Badge>
                      <CardTitle className="text-sm font-bold text-foreground">
                        {model.name}
                      </CardTitle>
                      <div className="text-[10px] font-mono text-muted-foreground truncate max-w-[200px]">
                        {model.id}
                      </div>
                    </div>
                    <Badge
                      variant={
                        model.status === 'verified'
                          ? 'success'
                          : model.status === 'documented'
                          ? 'outline'
                          : 'secondary'
                      }
                      className="text-[9px]"
                    >
                      {model.status === 'verified' ? 'API Verified' : 'Documented'}
                    </Badge>
                  </div>
                </CardHeader>

                <CardContent className="space-y-3 text-xs pt-3">
                  <div className="flex justify-between py-1 border-b border-border/40">
                    <span className="text-muted-foreground">Context Window:</span>
                    <span className="font-mono font-medium text-foreground text-right">
                      {model.context_window_display}
                    </span>
                  </div>

                  <div className="flex justify-between py-1 border-b border-border/40">
                    <span className="text-muted-foreground">Input Modalities:</span>
                    <span className="font-medium text-foreground text-right truncate max-w-[140px]">
                      {model.input_modalities.join(', ')}
                    </span>
                  </div>

                  <div className="flex justify-between py-1 border-b border-border/40">
                    <span className="text-muted-foreground">Streaming:</span>
                    <span>{renderCheckCross(model.streaming)}</span>
                  </div>

                  <div className="flex justify-between py-1 border-b border-border/40">
                    <span className="text-muted-foreground">Tool / Function Calling:</span>
                    <span>{renderCheckCross(model.tool_calling)}</span>
                  </div>

                  <div className="flex justify-between py-1 border-b border-border/40">
                    <span className="text-muted-foreground">Structured Output:</span>
                    <span>{renderCheckCross(model.structured_output)}</span>
                  </div>

                  <div className="py-1 border-b border-border/40 space-y-0.5">
                    <div className="text-[10px] text-muted-foreground">Quota / Free Tier:</div>
                    <div className="text-[11px] text-foreground font-medium truncate" title={model.free_tier}>
                      {model.free_tier}
                    </div>
                  </div>

                  <div className="py-1 space-y-0.5">
                    <div className="text-[10px] text-muted-foreground">License / Usage Terms:</div>
                    <div className="text-[11px] text-primary font-mono truncate" title={model.license}>
                      {model.license}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Filters and Search Toolbar */}
      <div className="flex flex-col sm:flex-row gap-3 items-center justify-between p-3 rounded-lg border border-border bg-card/60">
        <div className="flex flex-1 items-center gap-2 w-full sm:w-auto">
          <div className="relative w-full sm:w-72">
            <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              placeholder="Search model by name or ID…"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="h-8 pl-8 text-xs bg-background"
            />
          </div>
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <Select value={providerFilter} onValueChange={setProviderFilter}>
            <SelectTrigger className="h-8 w-36 text-xs bg-background">
              <SelectValue placeholder="All Providers" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Providers</SelectItem>
              <SelectItem value="gemini">Google Gemini</SelectItem>
              <SelectItem value="openai">OpenAI</SelectItem>
              <SelectItem value="qwen">Qwen / DashScope</SelectItem>
              <SelectItem value="ollama">Ollama</SelectItem>
              <SelectItem value="llamacpp">llama.cpp</SelectItem>
              <SelectItem value="custom">Custom</SelectItem>
            </SelectContent>
          </Select>

          <Select value={categoryFilter} onValueChange={setCategoryFilter}>
            <SelectTrigger className="h-8 w-32 text-xs bg-background">
              <SelectValue placeholder="Category" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Categories</SelectItem>
              <SelectItem value="cloud">Cloud APIs</SelectItem>
              <SelectItem value="local">Local Models</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Comprehensive Model Matrix Table */}
      <Card className="bg-card/70 border-border shadow-xs overflow-hidden">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold">Master Capability Matrix</CardTitle>
          <CardDescription className="text-xs">
            Click 'Compare' on any row to add or remove it from the side-by-side comparison view.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader className="bg-muted/40">
              <TableRow className="border-border">
                <TableHead className="w-12 text-center text-xs">Compare</TableHead>
                <TableHead className="text-xs">Model & Provider</TableHead>
                <TableHead className="text-xs">Category</TableHead>
                <TableHead className="text-xs">Context Window</TableHead>
                <TableHead className="text-xs">Inputs</TableHead>
                <TableHead className="text-xs">Streaming</TableHead>
                <TableHead className="text-xs">Tool Calling</TableHead>
                <TableHead className="text-xs">Structured JSON</TableHead>
                <TableHead className="text-xs">License / Terms</TableHead>
                <TableHead className="text-xs">Data Verification</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <TableRow key={i} className="border-border/60">
                    <TableCell><Skeleton className="h-6 w-10 mx-auto" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-32 mb-1" /><Skeleton className="h-3 w-20" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-14" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-20" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-12" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-12" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-12" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-16" /></TableCell>
                  </TableRow>
                ))
              ) : filteredModels.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={10} className="h-24 text-center text-xs text-muted-foreground">
                    No models matching filter criteria.
                  </TableCell>
                </TableRow>
              ) : (
                filteredModels.map(m => {
                  const isSelected = selectedModelIds.includes(m.id)
                  return (
                    <TableRow key={m.id} className="border-border/60 hover:bg-muted/20 text-xs">
                      <TableCell className="text-center">
                        <Button
                          variant={isSelected ? 'default' : 'outline'}
                          size="sm"
                          onClick={() => toggleSelectModel(m.id)}
                          className={`h-6 px-2 text-[10px] ${
                            isSelected
                              ? 'bg-primary text-primary-foreground'
                              : 'text-muted-foreground hover:text-foreground'
                          }`}
                        >
                          {isSelected ? 'Active' : '+ Add'}
                        </Button>
                      </TableCell>

                      <TableCell className="font-medium text-foreground">
                        <div>{m.name}</div>
                        <div className="text-[10px] font-mono text-muted-foreground">{m.id}</div>
                      </TableCell>

                      <TableCell>
                        <Badge
                          variant={m.category === 'cloud' ? 'secondary' : 'outline'}
                          className="text-[9px] uppercase"
                        >
                          {m.category}
                        </Badge>
                      </TableCell>

                      <TableCell className="font-mono text-[11px] text-foreground">
                        {m.context_window_display}
                      </TableCell>

                      <TableCell className="text-[11px] text-muted-foreground">
                        {m.input_modalities.join(', ')}
                      </TableCell>

                      <TableCell>{renderCheckCross(m.streaming)}</TableCell>

                      <TableCell>{renderCheckCross(m.tool_calling)}</TableCell>

                      <TableCell>{renderCheckCross(m.structured_output)}</TableCell>

                      <TableCell className="text-[11px] text-primary font-mono truncate max-w-[140px]" title={m.license}>
                        {m.license_type}
                      </TableCell>

                      <TableCell>
                        <Badge
                          variant={
                            m.status === 'verified'
                              ? 'success'
                              : m.status === 'documented'
                              ? 'outline'
                              : 'secondary'
                          }
                          className="text-[9px]"
                        >
                          {m.status === 'verified' ? 'API Verified' : 'Documented'}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  )
                })
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}

