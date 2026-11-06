import { useState, useEffect, useRef, useCallback } from 'react'
import {
  Send,
  Plus,
  Trash2,
  Copy,
  Check,
  RefreshCw,
  AlertCircle,
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
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Alert, AlertDescription } from '@/components/ui/alert'
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
import { api } from '@/services/api'
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
            content: 'Hello! I am connected to the unified Model Gateway. You can send prompts, switch between Cloud and Local AI providers, or test hardware limits in real-time.',
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
      try {
        const res = await api.getModels(cat, prov, customUrl)
        setAvailableModels(res.models || [])
        setModelNotice(res.notice)

        // Set default model if current is not in list
        if (res.models && res.models.length > 0) {
          if (!res.models.includes(modelId)) {
            setModelId(res.models[0])
          }
        }
      } catch (err: any) {
        console.error('Failed to discover models:', err)
        setAvailableModels([])
        setModelNotice(err.message || 'Unable to retrieve model list for this provider.')
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
            // Replace **bold**
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
            <span>{conversations.length} conversation{conversations.length !== 1 ? 's' : ''}</span>
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
                        {p.configured && (
                          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                        )}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {/* Model Selector */}
              <Select
                value={modelId}
                onValueChange={(val: string) => setModelId(val)}
                disabled={loadingModels || availableModels.length === 0}
              >
                <SelectTrigger className="h-8 w-52 text-xs bg-background">
                  <SelectValue placeholder={loadingModels ? 'Discovering models…' : 'Choose model'} />
                </SelectTrigger>
                <SelectContent className="max-h-60">
                  {availableModels.map(m => (
                    <SelectItem key={m} value={m}>
                      {m}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

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

            {/* Test Connection Button and Actions Dropdown */}
            <div className="flex items-center gap-1.5">
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
                Test Node
              </Button>

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-foreground">
                    <MoreVertical className="h-4 w-4" />
                    <span className="sr-only">Conversation actions</span>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-48 text-xs">
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
                      a.download = `${activeConversation.title.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.json`
                      a.click()
                      URL.revokeObjectURL(url)
                      toast.success('Conversation exported.')
                    }}
                    className="cursor-pointer gap-2"
                  >
                    <Download className="h-3.5 w-3.5 text-muted-foreground" />
                    Export Chat (.JSON)
                  </DropdownMenuItem>
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

          {/* Model Notice / Disclaimer Banner */}
          {modelNotice && (
            <div className="border-b border-amber-500/20 bg-amber-500/10 px-4 py-1.5 text-[11px] text-amber-400 flex items-center justify-between">
              <span>{modelNotice}</span>
              <Badge variant="outline" className="text-[9px] border-amber-500/30">
                Notice
              </Badge>
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
                  Switch between Cloud (Gemini, OpenAI, Qwen) and Local (Ollama, llama.cpp) at will.
                  The gateway routes all requests through a common interface without restarting.
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
                    <div key={msg.id} className="flex gap-3 justify-start">
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-destructive/10 text-destructive border border-destructive/20">
                        <AlertCircle className="h-4 w-4" />
                      </div>
                      <div className="max-w-2xl space-y-2">
                        <Alert variant="destructive" className="py-2.5">
                          <AlertCircle className="h-4 w-4" />
                          <AlertDescription className="text-xs font-mono">
                            {msg.errorDetail}
                          </AlertDescription>
                        </Alert>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleRetry(index)}
                          className="h-7 text-xs gap-1.5"
                        >
                          <RefreshCw className="h-3 w-3" />
                          Retry Request
                        </Button>
                      </div>
                    </div>
                  )
                }

                return (
                  <div
                    key={msg.id}
                    className={`flex gap-3 ${isUser ? 'justify-end' : 'justify-start'}`}
                  >
                    {!isUser && (
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary border border-primary/20">
                        <Bot className="h-4 w-4" />
                      </div>
                    )}

                    <div
                      className={`group relative max-w-2xl rounded-xl p-3.5 text-xs shadow-xs leading-relaxed ${
                        isUser
                          ? 'bg-primary text-primary-foreground font-normal'
                          : 'bg-card border border-border text-foreground'
                      }`}
                    >
                      {/* Message Meta Info */}
                      {!isUser && (
                        <div className="flex items-center justify-between pb-2 mb-2 border-b border-border/60 text-[10px] text-muted-foreground">
                          <span className="font-semibold text-foreground">
                            {msg.providerName || msg.provider} · {msg.model}
                          </span>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleCopy(msg.content, msg.id)}
                            className="h-5 w-5 text-muted-foreground hover:text-foreground"
                            title="Copy assistant response"
                          >
                            {copiedId === msg.id ? (
                              <Check className="h-3 w-3 text-emerald-400" />
                            ) : (
                              <Copy className="h-3 w-3" />
                            )}
                          </Button>
                        </div>
                      )}

                      <div>{renderMessageContent(msg.content)}</div>
                    </div>

                    {isUser && (
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-secondary text-secondary-foreground">
                        <User className="h-4 w-4" />
                      </div>
                    )}
                  </div>
                )
              })
            )}

            {/* Typing / Generating Indicator */}
            {generating && (
              <div className="flex gap-3 justify-start">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary border border-primary/20">
                  <Bot className="h-4 w-4" />
                </div>
                <div className="rounded-xl border border-border bg-card p-3 text-xs text-muted-foreground flex items-center gap-2">
                  <RefreshCw className="h-3 w-3 animate-spin text-primary" />
                  <span>Streaming response from {providerId} ({modelId})…</span>
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Composer Input Area */}
          <div className="border-t border-border bg-card/60 p-3">
            <div className="relative rounded-lg border border-border bg-background focus-within:ring-1 focus-within:ring-primary shadow-xs">
              <Textarea
                ref={textareaRef}
                value={inputMessage}
                onChange={e => setInputMessage(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={`Message ${providerId} · ${modelId || 'Select model'}…`}
                className="min-h-[72px] resize-none border-0 bg-transparent p-3 text-xs focus-visible:ring-0 leading-relaxed"
                disabled={generating}
              />
              <div className="flex items-center justify-between border-t border-border/50 bg-muted/20 px-3 py-1.5">
                <span className="text-[10px] text-muted-foreground">
                  Press <kbd className="rounded border border-border bg-background px-1 py-0.5 text-[9px]">Enter</kbd> to send, <kbd className="rounded border border-border bg-background px-1 py-0.5 text-[9px]">Shift+Enter</kbd> for newline
                </span>
                <Button
                  onClick={() => handleSendMessage()}
                  disabled={!inputMessage.trim() || generating}
                  size="sm"
                  className="h-7 px-3 text-xs gap-1.5 bg-primary text-primary-foreground hover:bg-primary/90"
                >
                  {generating ? (
                    <RefreshCw className="h-3 w-3 animate-spin" />
                  ) : (
                    <Send className="h-3 w-3" />
                  )}
                  Send
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </TooltipProvider>
  )
}

