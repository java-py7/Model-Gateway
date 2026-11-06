import { useState, useEffect, useRef, useCallback } from 'react'
import {
  Send,
  Plus,
  Trash2,
  Copy,
  Check,
  RefreshCw,
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Terminal,
  Server,
  Sparkles,
  Bot,
  User,
  PanelLeftClose,
  PanelLeft,
  Settings2,
  MoreVertical,
  Download,
  Eraser,
  ExternalLink,
  ShieldCheck,
  Zap,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { api, localRuntimeBridge } from '@/services/api'
import type { LocalRuntimeCheckResult } from '@/services/localRuntimeBridge'
import { useGateway } from '@/hooks/useGateway'
import type { ChatMessage, Conversation, ProviderCategory } from '@/types'
import { toast } from 'sonner'

export function PlaygroundPage() {
  const { allProviders, testProvider } = useGateway()

  // State: Active selections
  const [category, setCategory] = useState<ProviderCategory>('cloud')
  const [providerId, setProviderId] = useState<string>('gemini')
  const [modelId, setModelId] = useState<string>('gemini-2.5-flash')
  const [customBaseUrl, setCustomBaseUrl] = useState<string>('https://api.openai.com/v1')
  const [availableModels, setAvailableModels] = useState<string[]>([])
  const [loadingModels, setLoadingModels] = useState<boolean>(false)
  const [modelNotice, setModelNotice] = useState<string | null>(null)

  // Local Runtime Bridge status (direct browser -> localhost)
  const [localBridgeStatus, setLocalBridgeStatus] = useState<LocalRuntimeCheckResult | null>(null)
  const [showTroubleshooting, setShowTroubleshooting] = useState<boolean>(false)
  const [copiedCommand, setCopiedCommand] = useState<string | null>(null)

  // State: Conversations & Messages
  const [conversations, setConversations] = useState<Conversation[]>(() => {
    try {
      const saved = localStorage.getItem('model_gateway_conversations_v2')
      if (saved) return JSON.parse(saved)
    } catch {}
    return [
      {
        id: 'conv_default',
        title: 'Initial Model Test',
        category: 'cloud',
        provider: 'gemini',
        model: 'gemini-2.5-flash',
        created: Date.now(),
        updated: Date.now(),
        messages: [
          {
            id: 'm1',
            role: 'assistant',
            content:
              'Hello! I am connected to the unified Model Gateway. You can send prompts, switch between Cloud and Local AI providers, or test hardware limits in real-time.\n\nWhen using Local AI, requests route directly from your browser to your local Ollama or llama.cpp daemon.',
            timestamp: Date.now(),
            provider: 'gemini',
            providerName: 'Google Gemini',
            model: 'gemini-2.5-flash',
          },
        ],
      },
    ]
  })

  const [activeConvId, setActiveConvId] = useState<string>(() => {
    return conversations[0]?.id || 'conv_default'
  })

  const [inputMessage, setInputMessage] = useState('')
  const [generating, setGenerating] = useState(false)
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [testingConnection, setTestingConnection] = useState(false)
  const [copiedId, setCopiedId] = useState<string | null>(null)

  const messagesEndRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  // Save conversations to localStorage
  useEffect(() => {
    try {
      localStorage.setItem('model_gateway_conversations_v2', JSON.stringify(conversations))
    } catch {}
  }, [conversations])

  // Scroll to bottom when messages update
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  useEffect(() => {
    scrollToBottom()
  }, [conversations, activeConvId, generating])

  // Fetch models whenever provider or category changes
  const fetchModelsForProvider = useCallback(
    async (cat: ProviderCategory, prov: string, customUrl?: string) => {
      setLoadingModels(true)
      setModelNotice(null)

      if (cat === 'local') {
        try {
          const check =
            prov === 'llamacpp'
              ? await localRuntimeBridge.checkLlamaCppStatus(customUrl)
              : await localRuntimeBridge.checkOllamaStatus(customUrl)
          setLocalBridgeStatus(check)
          setAvailableModels(check.models || [])

          if (check.status === 'connected') {
            setShowTroubleshooting(false)
            if (check.models && check.models.length > 0) {
              if (!check.models.includes(modelId)) {
                setModelId(check.models[0])
              }
            } else {
              setModelNotice('Runtime is online but no models were found. Pull a model using the command below.')
              setShowTroubleshooting(true)
            }
          } else {
            setShowTroubleshooting(true)
            setModelNotice(check.message)
          }
        } catch (err: any) {
          setAvailableModels([])
          setModelNotice(err.message || 'Unable to reach local AI runtime.')
          setShowTroubleshooting(true)
        } finally {
          setLoadingModels(false)
        }
        return
      }

      // Cloud category
      setLocalBridgeStatus(null)
      setShowTroubleshooting(false)
      try {
        const res = await api.getModels(cat, prov, customUrl)
        setAvailableModels(res.models || [])
        setModelNotice(res.notice)

        if (res.models && res.models.length > 0) {
          if (!res.models.includes(modelId)) {
            setModelId(res.models[0])
          }
        }
      } catch (err: any) {
        console.error('Failed to discover cloud models:', err)
        setAvailableModels([])
        setModelNotice(err.message || 'Unable to retrieve model list for this cloud provider.')
      } finally {
        setLoadingModels(false)
      }
    },
    [modelId]
  )

  useEffect(() => {
    fetchModelsForProvider(category, providerId, providerId === 'custom' ? customBaseUrl : undefined)
  }, [category, providerId, fetchModelsForProvider])

  // Active conversation object
  const activeConversation = conversations.find(c => c.id === activeConvId) || conversations[0]

  // Create new conversation
  const handleNewConversation = () => {
    const newConv: Conversation = {
      id: `conv_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      title: 'New conversation',
      category,
      provider: providerId,
      model: modelId,
      custom_base_url: providerId === 'custom' ? customBaseUrl : undefined,
      created: Date.now(),
      updated: Date.now(),
      messages: [],
    }
    setConversations(prev => [newConv, ...prev])
    setActiveConvId(newConv.id)
    textareaRef.current?.focus()
  }

  // Delete conversation
  const handleDeleteConversation = (id: string, e: React.MouseEvent) => {
    e.stopPropagation()
    const remaining = conversations.filter(c => c.id !== id)
    if (remaining.length === 0) {
      const resetConv: Conversation = {
        id: `conv_${Date.now()}`,
        title: 'New conversation',
        category,
        provider: providerId,
        model: modelId,
        created: Date.now(),
        updated: Date.now(),
        messages: [],
      }
      setConversations([resetConv])
      setActiveConvId(resetConv.id)
    } else {
      setConversations(remaining)
      if (activeConvId === id) {
        setActiveConvId(remaining[0].id)
      }
    }
    toast.success('Conversation removed.')
  }

  // Test provider connection
  const handleTestConnection = async () => {
    setTestingConnection(true)
    try {
      const res = await testProvider(
        category,
        providerId,
        providerId === 'custom' ? customBaseUrl : undefined
      )
      toast.success(res.message)
      // Re-fetch models on successful test
      fetchModelsForProvider(category, providerId, providerId === 'custom' ? customBaseUrl : undefined)
    } catch (err: any) {
      toast.error(`Connection failed: ${err.message}`)
    } finally {
      setTestingConnection(false)
    }
  }

  // Send message
  const handleSendMessage = async (overrideMessage?: string) => {
    const textToSend = overrideMessage !== undefined ? overrideMessage : inputMessage.trim()
    if (!textToSend || generating) return

    if (!modelId) {
      toast.error('Please select an active model before sending a message.')
      return
    }

    if (category === 'local' && localBridgeStatus && localBridgeStatus.status !== 'connected') {
      toast.error(`Local runtime is ${localBridgeStatus.status}. Please check setup guide above.`)
      setShowTroubleshooting(true)
      return
    }

    const userMessage: ChatMessage = {
      id: `m_${Date.now()}_u`,
      role: 'user',
      content: textToSend,
      timestamp: Date.now(),
      category,
      provider: providerId,
      model: modelId,
    }

    // Update conversation with user message
    setConversations(prev =>
      prev.map(c => {
        if (c.id === activeConvId) {
          const isFirstMessage = c.messages.length === 0
          return {
            ...c,
            title: isFirstMessage
              ? textToSend.length > 28
                ? textToSend.substring(0, 28) + '…'
                : textToSend
              : c.title,
            updated: Date.now(),
            messages: [...c.messages, userMessage],
          }
        }
        return c
      })
    )

    if (overrideMessage === undefined) {
      setInputMessage('')
    }
    setGenerating(true)

    const selectedProvObj = allProviders.find(p => p.id === providerId)
    const providerLabel = selectedProvObj ? selectedProvObj.name : providerId

    try {
      const response = await api.sendChat({
        category,
        provider: providerId,
        model: modelId,
        message: textToSend,
        custom_base_url: providerId === 'custom' ? customBaseUrl : undefined,
      })

      const assistantMessage: ChatMessage = {
        id: `m_${Date.now()}_a`,
        role: 'assistant',
        content: response.response,
        timestamp: Date.now(),
        provider: providerId,
        providerName: providerLabel,
        model: modelId,
        category,
      }

      setConversations(prev =>
        prev.map(c => {
          if (c.id === activeConvId) {
            return {
              ...c,
              updated: Date.now(),
              messages: [...c.messages, assistantMessage],
            }
          }
          return c
        })
      )
    } catch (err: any) {
      const errorMessage: ChatMessage = {
        id: `m_${Date.now()}_err`,
        role: 'assistant',
        content: err.message || 'Generation failed',
        timestamp: Date.now(),
        provider: providerId,
        providerName: providerLabel,
        model: modelId,
        category,
        error: true,
        errorDetail: err.message,
      }

      setConversations(prev =>
        prev.map(c => {
          if (c.id === activeConvId) {
            return {
              ...c,
              updated: Date.now(),
              messages: [...c.messages, errorMessage],
            }
          }
          return c
        })
      )
      toast.error(`Provider error: ${err.message}`)
      if (category === 'local') {
        setShowTroubleshooting(true)
      }
    } finally {
      setGenerating(false)
      textareaRef.current?.focus()
    }
  }

  // Retry failed message
  const handleRetry = (msgIndex: number) => {
    if (!activeConversation) return
    const targetUserMsg = activeConversation.messages[msgIndex - 1]
    if (targetUserMsg && targetUserMsg.role === 'user') {
      handleSendMessage(targetUserMsg.content)
    }
  }

  // Copy assistant response
  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text)
    setCopiedId(id)
    toast.success('Response copied to clipboard.')
    setTimeout(() => setCopiedId(null), 2000)
  }

  const handleCopyCommand = (cmd: string) => {
    navigator.clipboard.writeText(cmd)
    setCopiedCommand(cmd)
    toast.success('Command copied.')
    setTimeout(() => setCopiedCommand(null), 2000)
  }

  // Keydown handler: Enter to send, Shift+Enter for newline
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSendMessage()
    }
  }

  // Parse markdown code blocks in text
  const renderMessageContent = (content: string) => {
    const parts = content.split(/(```[\s\S]*?```)/g)

    return parts.map((part, index) => {
      if (part.startsWith('```') && part.endsWith('```')) {
        const firstLineEnd = part.indexOf('\n')
        const language =
          firstLineEnd !== -1 ? part.substring(3, firstLineEnd).trim() : ''
        const code =
          firstLineEnd !== -1
            ? part.substring(firstLineEnd + 1, part.length - 3)
            : part.substring(3, part.length - 3)

        return (
          <div
            key={index}
            className="my-3 overflow-hidden rounded-md border border-border bg-zinc-950 font-mono text-xs shadow-xs"
          >
            <div className="flex items-center justify-between border-b border-zinc-800 bg-zinc-900/90 px-3 py-1.5 text-[11px] text-zinc-400">
              <span>{language || 'code'}</span>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  navigator.clipboard.writeText(code)
                  toast.success('Code copied.')
                }}
                className="h-6 px-2 text-[10px] text-zinc-400 hover:text-white"
              >
                <Copy className="mr-1 h-3 w-3" />
                Copy
              </Button>
            </div>
            <pre className="p-3 overflow-x-auto text-zinc-200 leading-relaxed">
              <code>{code}</code>
            </pre>
          </div>
        )
      }

      // Format bold text and newlines
      const lines = part.split('\n')
      return (
        <span key={index}>
          {lines.map((line, lIdx) => {
            const boldParts = line.split(/(\*\*.*?\*\*)/g)
            return (
              <span key={lIdx}>
                {boldParts.map((bPart, bIdx) => {
                  if (bPart.startsWith('**') && bPart.endsWith('**')) {
                    return (
                      <strong key={bIdx} className="font-semibold text-foreground">
                        {bPart.substring(2, bPart.length - 2)}
                      </strong>
                    )
                  }
                  if (bPart.startsWith('`') && bPart.endsWith('`')) {
                    return (
                      <code
                        key={bIdx}
                        className="rounded bg-muted px-1.5 py-0.5 font-mono text-[11px] text-primary"
                      >
                        {bPart.substring(1, bPart.length - 1)}
                      </code>
                    )
                  }
                  return bPart
                })}
                {lIdx < lines.length - 1 && <br />}
              </span>
            )
          })}
        </span>
      )
    })
  }

  // Filter providers by selected category
  const activeCategoryProviders = allProviders.filter(p => p.category === category)
  const currentEndpoint =
    category === 'local'
      ? localRuntimeBridge.getProviderUrl(providerId)
      : 'FastAPI Backend'

  return (
    <TooltipProvider>
      <div className="flex h-[calc(100vh-5.5rem)] rounded-xl border border-border bg-card/40 overflow-hidden shadow-xs">
        {/* Chat History Sidebar */}
        <div
          className={`flex flex-col border-r border-border bg-sidebar transition-all duration-200 ${
            sidebarOpen ? 'w-64' : 'w-0 -ml-1 overflow-hidden'
          }`}
        >
          {/* New Chat Button */}
          <div className="p-3 border-b border-border/80 flex items-center justify-between gap-2">
            <Button
              onClick={handleNewConversation}
              size="sm"
              className="w-full text-xs gap-1.5 bg-primary text-primary-foreground hover:bg-primary/90"
            >
              <Plus className="h-3.5 w-3.5" />
              New Conversation
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setSidebarOpen(false)}
              className="h-8 w-8 text-muted-foreground hover:text-foreground shrink-0"
              title="Collapse conversation list"
            >
              <PanelLeftClose className="h-4 w-4" />
            </Button>
          </div>

          {/* Conversations List with ScrollArea */}
          <ScrollArea className="flex-1 p-2">
            <div className="space-y-1">
              <div className="px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                History
              </div>
              {conversations.map(conv => (
                <div
                  key={conv.id}
                  onClick={() => setActiveConvId(conv.id)}
                  className={`group flex items-center justify-between rounded-md px-2.5 py-2 text-xs transition-colors cursor-pointer ${
                    conv.id === activeConvId
                      ? 'bg-accent font-medium text-foreground'
                      : 'text-muted-foreground hover:bg-accent/50 hover:text-foreground'
                  }`}
                >
                  <div className="flex items-center gap-2 truncate">
                    <span className="truncate">{conv.title}</span>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={e => handleDeleteConversation(conv.id, e)}
                    className="h-6 w-6 opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive transition-opacity"
                    title="Delete conversation"
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              ))}
            </div>
          </ScrollArea>

          {/* Sidebar Footer Stats */}
          <div className="p-3 border-t border-border/70 text-[11px] text-muted-foreground bg-muted/20 flex items-center justify-between">
            <span>
              {conversations.length} conversation{conversations.length !== 1 ? 's' : ''}
            </span>
            <Badge variant="outline" className="text-[9px] px-1 py-0">
              localStorage
            </Badge>
          </div>
        </div>

        {/* Main Chat Viewport */}
        <div className="flex flex-1 flex-col overflow-hidden bg-background">
          {/* Provider Selection Toolbar */}
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border bg-card/60 px-4 py-2.5">
            <div className="flex flex-wrap items-center gap-2">
              {!sidebarOpen && (
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setSidebarOpen(true)}
                  className="h-8 w-8 text-muted-foreground hover:text-foreground mr-1"
                  title="Expand conversations list"
                >
                  <PanelLeft className="h-4 w-4" />
                </Button>
              )}

              {/* Category Selector */}
              <Select
                value={category}
                onValueChange={(val: ProviderCategory) => {
                  setCategory(val)
                  if (val === 'cloud') {
                    setProviderId('gemini')
                  } else {
                    setProviderId('ollama')
                  }
                }}
              >
                <SelectTrigger className="h-8 w-28 text-xs bg-background">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="cloud">Cloud AI</SelectItem>
                  <SelectItem value="local">Local AI</SelectItem>
                </SelectContent>
              </Select>

              {/* Provider Selector */}
              <Select
                value={providerId}
                onValueChange={(val: string) => {
                  setProviderId(val)
                }}
              >
                <SelectTrigger className="h-8 w-44 text-xs bg-background">
                  <SelectValue placeholder="Select provider" />
                </SelectTrigger>
                <SelectContent>
                  {activeCategoryProviders.map(p => (
                    <SelectItem key={p.id} value={p.id}>
                      <div className="flex items-center gap-1.5">
                        <span>{p.name}</span>
                        {p.category === 'local' ? (
                          <span className="text-[9px] text-muted-foreground font-mono">
                            (Localhost)
                          </span>
                        ) : p.configured ? (
                          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                        ) : null}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {/* Model Selector */}
              <div className="flex items-center gap-1">
                <Select
                  value={modelId}
                  onValueChange={(val: string) => setModelId(val)}
                  disabled={loadingModels || availableModels.length === 0}
                >
                  <SelectTrigger className="h-8 w-52 text-xs bg-background">
                    <SelectValue
                      placeholder={
                        loadingModels
                          ? 'Detecting models…'
                          : availableModels.length === 0
                          ? 'No models installed'
                          : 'Choose model'
                      }
                    />
                  </SelectTrigger>
                  <SelectContent className="max-h-60">
                    {availableModels.map(m => (
                      <SelectItem key={m} value={m}>
                        <div className="flex items-center justify-between w-full gap-2">
                          <span>{m}</span>
                          {category === 'local' && (
                            <Badge variant="outline" className="text-[9px] px-1 py-0">
                              local
                            </Badge>
                          )}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                {/* Refresh Models Button */}
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() =>
                        fetchModelsForProvider(
                          category,
                          providerId,
                          providerId === 'custom' ? customBaseUrl : undefined
                        )
                      }
                      disabled={loadingModels}
                      className="h-8 w-8 text-muted-foreground hover:text-foreground"
                    >
                      <RefreshCw className={`h-3.5 w-3.5 ${loadingModels ? 'animate-spin' : ''}`} />
                      <span className="sr-only">Refresh models</span>
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="bottom" className="text-xs">
                    {category === 'local'
                      ? 'Re-scan installed models on your computer'
                      : 'Refresh model catalog'}
                  </TooltipContent>
                </Tooltip>
              </div>

              {/* Custom Base URL Input if custom provider */}
              {providerId === 'custom' && (
                <div className="flex items-center gap-1.5">
                  <Input
                    placeholder="https://your-custom-endpoint/v1"
                    value={customBaseUrl}
                    onChange={e => setCustomBaseUrl(e.target.value)}
                    className="h-8 w-60 text-xs font-mono"
                  />
                </div>
              )}
            </div>

            {/* Architecture Badge, Test Button and Actions Dropdown */}
            <div className="flex items-center gap-2">
              {/* Architecture Indicator Badge */}
              {category === 'local' ? (
                localBridgeStatus?.status === 'connected' ? (
                  <Badge
                    variant="outline"
                    className="hidden lg:flex items-center gap-1.5 text-[10px] font-normal border-emerald-500/30 bg-emerald-500/10 text-emerald-400 py-0.5"
                  >
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                    <span>Direct Bridge: {currentEndpoint}</span>
                  </Badge>
                ) : localBridgeStatus?.status === 'cors_blocked' ? (
                  <Badge
                    variant="outline"
                    onClick={() => setShowTroubleshooting(true)}
                    className="hidden lg:flex items-center gap-1.5 text-[10px] font-normal border-amber-500/30 bg-amber-500/10 text-amber-400 py-0.5 cursor-pointer hover:bg-amber-500/20"
                  >
                    <AlertTriangle className="h-3 w-3" />
                    <span>CORS Setup Required</span>
                  </Badge>
                ) : (
                  <Badge
                    variant="outline"
                    onClick={() => setShowTroubleshooting(true)}
                    className="hidden lg:flex items-center gap-1.5 text-[10px] font-normal border-destructive/30 bg-destructive/10 text-destructive py-0.5 cursor-pointer hover:bg-destructive/20"
                  >
                    <XCircle className="h-3 w-3" />
                    <span>Localhost Offline</span>
                  </Badge>
                )
              ) : (
                <Badge
                  variant="outline"
                  className="hidden lg:flex items-center gap-1.5 text-[10px] font-normal border-primary/30 bg-primary/10 text-primary py-0.5"
                >
                  <ShieldCheck className="h-3 w-3" />
                  <span>Cloud Gateway via FastAPI</span>
                </Badge>
              )}

              <Button
                variant="outline"
                size="sm"
                onClick={handleTestConnection}
                disabled={testingConnection}
                className="h-8 text-xs gap-1.5"
              >
                {testingConnection ? (
                  <RefreshCw className="h-3 w-3 animate-spin" />
                ) : (
                  <Server className="h-3 w-3 text-primary" />
                )}
                {category === 'local' ? 'Test Localhost' : 'Test Node'}
              </Button>

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-muted-foreground hover:text-foreground"
                  >
                    <MoreVertical className="h-4 w-4" />
                    <span className="sr-only">Conversation actions</span>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-52 text-xs">
                  <DropdownMenuLabel className="text-[11px]">Chat Actions</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onClick={() => {
                      if (!activeConversation) return
                      const transcript = activeConversation.messages
                        .map(m => `${m.role.toUpperCase()}: ${m.content}`)
                        .join('\n\n')
                      navigator.clipboard.writeText(transcript)
                      toast.success('Conversation transcript copied to clipboard.')
                    }}
                    className="cursor-pointer gap-2"
                  >
                    <Copy className="h-3.5 w-3.5 text-primary" />
                    Copy Transcript
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => {
                      if (!activeConversation) return
                      const blob = new Blob([JSON.stringify(activeConversation, null, 2)], {
                        type: 'application/json',
                      })
                      const url = URL.createObjectURL(blob)
                      const a = document.createElement('a')
                      a.href = url
                      a.download = `${activeConversation.title
                        .replace(/[^a-z0-9]/gi, '_')
                        .toLowerCase()}.json`
                      a.click()
                      URL.revokeObjectURL(url)
                      toast.success('Conversation exported.')
                    }}
                    className="cursor-pointer gap-2"
                  >
                    <Download className="h-3.5 w-3.5 text-muted-foreground" />
                    Export Chat (.JSON)
                  </DropdownMenuItem>
                  {category === 'local' && (
                    <DropdownMenuItem
                      onClick={() => setShowTroubleshooting(prev => !prev)}
                      className="cursor-pointer gap-2"
                    >
                      <Terminal className="h-3.5 w-3.5 text-primary" />
                      {showTroubleshooting ? 'Hide Setup Guide' : 'Show Local Setup Guide'}
                    </DropdownMenuItem>
                  )}
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onClick={() => {
                      if (!activeConversation) return
                      setConversations(prev =>
                        prev.map(c => (c.id === activeConvId ? { ...c, messages: [] } : c))
                      )
                      toast.info('Conversation messages cleared.')
                    }}
                    className="cursor-pointer gap-2 text-destructive focus:text-destructive"
                  >
                    <Eraser className="h-3.5 w-3.5" />
                    Clear Messages
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>

          {/* Local Runtime Troubleshooting & Setup Guide Alert */}
          {category === 'local' && showTroubleshooting && (
            <div className="border-b border-border bg-card/90 px-4 py-3 text-xs">
              <div className="flex items-start justify-between gap-3">
                <div className="space-y-1.5 flex-1">
                  <div className="flex items-center gap-2">
                    <Terminal className="h-4 w-4 text-primary" />
                    <span className="font-semibold text-foreground">
                      Local Runtime Bridge Instructions ({providerId === 'ollama' ? 'Ollama' : 'llama.cpp'})
                    </span>
                    <Badge variant="outline" className="text-[10px]">
                      Direct Browser → Localhost
                    </Badge>
                  </div>
                  <p className="text-[11px] text-muted-foreground leading-relaxed">
                    Model Gateway deployed on Render connects directly from your web browser to{' '}
                    <code className="text-primary font-mono">{currentEndpoint}</code> on your computer.
                    Your weights and prompts remain entirely on your machine.
                  </p>

                  {providerId === 'ollama' ? (
                    <div className="pt-2 grid grid-cols-1 md:grid-cols-2 gap-2 text-[11px]">
                      <div className="rounded border border-border/80 bg-zinc-950/60 p-2 space-y-1">
                        <div className="font-medium text-zinc-300 flex items-center justify-between">
                          <span>1. Start daemon & pull model</span>
                        </div>
                        <div className="font-mono text-[10px] text-zinc-400 flex items-center justify-between bg-zinc-900 px-2 py-1 rounded">
                          <span>ollama pull llama3.2:1b</span>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleCopyCommand('ollama pull llama3.2:1b')}
                            className="h-5 w-5 text-zinc-400 hover:text-white"
                          >
                            <Copy className="h-3 w-3" />
                          </Button>
                        </div>
                      </div>

                      <div className="rounded border border-border/80 bg-zinc-950/60 p-2 space-y-1">
                        <div className="font-medium text-zinc-300 flex items-center justify-between">
                          <span>2. Enable browser CORS access</span>
                          <span className="text-[9px] text-amber-400">Essential for Web</span>
                        </div>
                        <div className="font-mono text-[10px] text-zinc-400 flex items-center justify-between bg-zinc-900 px-2 py-1 rounded">
                          <span>setx OLLAMA_ORIGINS "*"</span>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleCopyCommand('setx OLLAMA_ORIGINS "*"')}
                            className="h-5 w-5 text-zinc-400 hover:text-white"
                          >
                            <Copy className="h-3 w-3" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="pt-2 rounded border border-border/80 bg-zinc-950/60 p-2 space-y-1 text-[11px]">
                      <div className="font-medium text-zinc-300">Start llama-server on port 8080:</div>
                      <div className="font-mono text-[10px] text-zinc-400 flex items-center justify-between bg-zinc-900 px-2 py-1 rounded">
                        <span>llama-server -m ./models/model.gguf --port 8080 --host 127.0.0.1</span>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() =>
                            handleCopyCommand(
                              'llama-server -m ./models/model.gguf --port 8080 --host 127.0.0.1'
                            )
                          }
                          className="h-5 w-5 text-zinc-400 hover:text-white"
                        >
                          <Copy className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                  )}
                </div>

                <div className="flex flex-col gap-1 shrink-0">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() =>
                      fetchModelsForProvider(
                        category,
                        providerId,
                        providerId === 'custom' ? customBaseUrl : undefined
                      )
                    }
                    className="h-7 text-[11px] gap-1"
                  >
                    <RefreshCw className="h-3 w-3" />
                    Retry Check
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => setShowTroubleshooting(false)}
                    className="h-6 text-[10px] text-muted-foreground"
                  >
                    Dismiss
                  </Button>
                </div>
              </div>
            </div>
          )}

          {/* Model Notice Banner */}
          {modelNotice && !showTroubleshooting && (
            <div className="border-b border-amber-500/20 bg-amber-500/10 px-4 py-1.5 text-[11px] text-amber-400 flex items-center justify-between">
              <span>{modelNotice}</span>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowTroubleshooting(true)}
                className="h-5 px-1.5 text-[10px] text-amber-300 hover:underline"
              >
                Setup Guide
              </Button>
            </div>
          )}

          {/* Messages Area */}
          <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-4">
            {activeConversation?.messages.length === 0 ? (
              <div className="flex h-full flex-col items-center justify-center text-center p-6 space-y-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-primary border border-primary/20">
                  <Bot className="h-6 w-6" />
                </div>
                <h3 className="text-base font-semibold text-foreground">
                  Ready to test with {providerId.toUpperCase()}
                </h3>
                <p className="max-w-md text-xs text-muted-foreground leading-relaxed">
                  {category === 'local'
                    ? `Direct browser bridge active. Prompts and tokens execute on your local machine at ${currentEndpoint}.`
                    : 'Switch between Cloud (Gemini, OpenAI, Qwen) and Local (Ollama, llama.cpp) seamlessly without restarting the server.'}
                </p>
                <div className="flex flex-wrap justify-center gap-2 pt-2">
                  {[
                    'Explain provider abstraction in AI tooling.',
                    'Compare quantization formats: Q4_K_M vs FP16.',
                    'Write a Python script for testing local inference latency.',
                  ].map((preset, i) => (
                    <Button
                      key={i}
                      variant="outline"
                      size="sm"
                      onClick={() => handleSendMessage(preset)}
                      className="text-xs bg-card/60"
                    >
                      "{preset}"
                    </Button>
                  ))}
                </div>
              </div>
            ) : (
              activeConversation?.messages.map((msg, index) => {
                const isUser = msg.role === 'user'

                if (msg.error) {
                  return (
                    <div key={msg.id} className="flex flex-col items-center my-4">
                      <Alert variant="destructive" className="max-w-2xl text-xs py-3">
                        <AlertCircle className="h-4 w-4" />
                        <AlertTitle className="text-xs font-semibold">Generation Error</AlertTitle>
                        <AlertDescription className="text-xs mt-1 space-y-2">
                          <p>{msg.content}</p>
                          <div className="flex items-center gap-2 pt-1">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleRetry(index)}
                              className="h-7 text-xs bg-background/50 hover:bg-background"
                            >
                              Retry Request
                            </Button>
                            {msg.category === 'local' && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => setShowTroubleshooting(true)}
                                className="h-7 text-xs"
                              >
                                View Localhost Setup Guide
                              </Button>
                            )}
                          </div>
                        </AlertDescription>
                      </Alert>
                    </div>
                  )
                }

                return (
                  <div
                    key={msg.id}
                    className={`flex gap-3 text-xs leading-relaxed ${
                      isUser ? 'justify-end' : 'justify-start'
                    }`}
                  >
                    {!isUser && (
                      <div className="flex h-8 w-8 shrink-0 select-none items-center justify-center rounded-lg border border-primary/20 bg-primary/10 text-primary">
                        <Bot className="h-4 w-4" />
                      </div>
                    )}

                    <div
                      className={`group relative max-w-[85%] md:max-w-[75%] rounded-lg p-3.5 shadow-xs ${
                        isUser
                          ? 'bg-primary text-primary-foreground font-normal'
                          : 'bg-card border border-border text-card-foreground'
                      }`}
                    >
                      {/* Message Metadata Header */}
                      <div className="flex items-center justify-between gap-4 mb-1.5 pb-1 border-b border-border/40 text-[10px] opacity-75">
                        <span className="font-medium">
                          {isUser
                            ? 'You'
                            : `${msg.providerName || msg.provider || 'AI'} • ${msg.model || ''}`}
                        </span>
                        <div className="flex items-center gap-1.5">
                          {msg.category === 'local' && !isUser && (
                            <Badge variant="outline" className="text-[9px] px-1 py-0 h-4">
                              Localhost
                            </Badge>
                          )}
                          <span>{new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                        </div>
                      </div>

                      {/* Content */}
                      <div className="break-words space-y-1">
                        {renderMessageContent(msg.content)}
                      </div>

                      {/* Message Action Footer */}
                      {!isUser && (
                        <div className="mt-2 pt-1.5 flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleCopy(msg.content, msg.id)}
                            className="h-6 w-6 text-muted-foreground hover:text-foreground"
                            title="Copy message"
                          >
                            {copiedId === msg.id ? (
                              <Check className="h-3 w-3 text-emerald-400" />
                            ) : (
                              <Copy className="h-3 w-3" />
                            )}
                          </Button>
                        </div>
                      )}
                    </div>

                    {isUser && (
                      <div className="flex h-8 w-8 shrink-0 select-none items-center justify-center rounded-lg border border-border bg-muted text-muted-foreground">
                        <User className="h-4 w-4" />
                      </div>
                    )}
                  </div>
                )
              })
            )}

            {generating && (
              <div className="flex gap-3 text-xs justify-start items-center">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-primary/20 bg-primary/10 text-primary">
                  <Bot className="h-4 w-4" />
                </div>
                <div className="rounded-lg border border-border bg-card p-3 text-muted-foreground flex items-center gap-2">
                  <RefreshCw className="h-3.5 w-3.5 animate-spin text-primary" />
                  <span>
                    Generating response via {category === 'local' ? 'Local Bridge' : 'Cloud Gateway'}…
                  </span>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Prompt Input Box */}
          <div className="p-3 md:p-4 border-t border-border bg-card/40">
            <div className="flex flex-col gap-2">
              <div className="relative rounded-lg border border-border bg-background focus-within:border-primary focus-within:ring-1 focus-within:ring-primary transition-all">
                <Textarea
                  ref={textareaRef}
                  placeholder={
                    category === 'local' && localBridgeStatus?.status !== 'connected'
                      ? 'Local AI runtime is currently offline or blocked by CORS. See setup guide above…'
                      : `Ask ${providerId.toUpperCase()} with ${modelId || 'selected model'}… (Shift+Enter for newline)`
                  }
                  value={inputMessage}
                  onChange={e => setInputMessage(e.target.value)}
                  onKeyDown={handleKeyDown}
                  disabled={generating}
                  className="min-h-[70px] max-h-48 resize-none border-0 bg-transparent text-xs p-3 focus-visible:ring-0 focus-visible:ring-offset-0"
                />

                <div className="flex items-center justify-between px-3 py-2 border-t border-border/50 bg-muted/20">
                  <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                    <span className="font-mono text-[10px]">
                      {category === 'local' ? 'Localhost Bridge' : 'Cloud Gateway'}
                    </span>
                    <span>•</span>
                    <span className="font-medium text-foreground">{modelId || 'No model chosen'}</span>
                  </div>

                  <Button
                    onClick={() => handleSendMessage()}
                    disabled={!inputMessage.trim() || generating || !modelId}
                    size="sm"
                    className="h-7 px-3 text-xs gap-1.5 bg-primary text-primary-foreground hover:bg-primary/90"
                  >
                    <span>Send</span>
                    <Send className="h-3 w-3" />
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </TooltipProvider>
  )
}
