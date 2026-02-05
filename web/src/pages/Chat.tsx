import { useState, useEffect, useRef, useCallback } from 'react'
import { useSearchParams } from 'react-router-dom'
import {
  Plus,
  Trash2,
  MessageSquare,
  X,
  Check,
  Edit2,
  ChevronDown,
  ChevronRight,
  Wrench,
  CheckCircle2,
  Brain,
  Paperclip,
  Cpu,
  AlertCircle,
  CornerDownLeft,
  Square,
  Search,
  ChevronsUpDown,
  ChevronsDownUp,
  PanelLeftOpen,
  Info,
  Loader2,
} from 'lucide-react'
import clsx from 'clsx'

interface Conversation {
  id: string
  title: string
  session_id: string
  work_dir: string
  created_at: string
  updated_at: string
  message_count: number
}

interface TokenUsage {
  prompt_tokens: number
  completion_tokens: number
  total_tokens: number
}

interface StatusInfo {
  context_usage: number | null
  token_usage: TokenUsage | null
}

interface Message {
  id: string
  role: 'user' | 'assistant' | 'thinking' | 'tool_call' | 'tool_result' | 'approval' | 'error'
  content: string
  metadata?: {
    tool_name?: string
    arguments?: Record<string, unknown>
    tool_call_id?: string
    output?: string
    action?: string
    description?: string
    is_error?: boolean
  }
}

interface FileAttachment {
  id: string
  type: 'file' | 'image'
  url: string  // blob URL for preview
  mediaType: string
  filename: string
  file?: File  // actual file object
  uploadedUrl?: string  // URL returned from backend after upload
}

interface UploadedFile {
  url: string
  filename: string
}

interface Model {
  id: string
  name: string
  provider: string
}

export default function Chat() {
  const [searchParams, setSearchParams] = useSearchParams()
  const convId = searchParams.get('id')

  const [conversations, setConversations] = useState<Conversation[]>([])
  const [messages, setMessages] = useState<Message[]>([])
  const [streamingContent, setStreamingContent] = useState('')
  const [input, setInput] = useState('')
  const [attachments, setAttachments] = useState<FileAttachment[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [isConnected, setIsConnected] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editTitle, setEditTitle] = useState('')
  const [showSidebar, setShowSidebar] = useState(true)
  
  // Status and settings
  const [statusInfo, setStatusInfo] = useState<StatusInfo>({ context_usage: null, token_usage: null })
  const [thinkingEnabled, setThinkingEnabled] = useState(true)
  const [selectedModel, setSelectedModel] = useState('kimi-k2-5')
  const [showModelSelector, setShowModelSelector] = useState(false)
  const [blocksExpanded, setBlocksExpanded] = useState(false)
  
  // Collapsible sections - store expanded state for each message id
  const [expandedThink, setExpandedThink] = useState<Set<string>>(new Set())
  const [expandedTool, setExpandedTool] = useState<Set<string>>(new Set())

  const wsRef = useRef<WebSocket | null>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const models: Model[] = [
    { id: 'kimi-k2-5', name: 'kimi-k2-5', provider: 'moonshotai' },
    { id: 'kimi-k2-thinking-turbo', name: 'kimi-k2-thinking-turbo', provider: 'moonshotai' },
    { id: 'gpt-5', name: 'gpt-5', provider: 'openai' },
    { id: 'claude-sonnet-4-5', name: 'claude-sonnet-4-5', provider: 'anthropic' },
    { id: 'gemini-3-pro', name: 'gemini-3-pro', provider: 'google' },
  ]

  // Fetch conversations list
  const fetchConversations = useCallback(async () => {
    try {
      const res = await fetch('/api/conversations')
      const data = await res.json()
      setConversations(data.conversations || [])
    } catch (err) {
      console.error('Failed to fetch conversations:', err)
    }
  }, [])

  useEffect(() => {
    fetchConversations()
  }, [fetchConversations])

  // Scroll to bottom when messages or streaming content changes
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, streamingContent])

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto'
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 200)}px`
    }
  }, [input])

  // Connect WebSocket when conversation changes
  useEffect(() => {
    if (!convId) {
      setMessages([])
      setIsConnected(false)
      setStatusInfo({ context_usage: null, token_usage: null })
      return
    }

    if (wsRef.current) {
      wsRef.current.close()
    }

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
    const ws = new WebSocket(`${protocol}//${window.location.host}/api/conversations/ws/${convId}`)
    wsRef.current = ws

    ws.onopen = () => {
      setIsConnected(true)
    }

    ws.onmessage = (event) => {
      const data = JSON.parse(event.data)

      switch (data.type) {
        case 'user':
          setMessages((prev) => [...prev, {
            id: Date.now().toString(),
            role: 'user',
            content: data.content
          }])
          break
        case 'chunk':
          setStreamingContent((prev) => prev + data.content)
          break
        case 'assistant':
          setMessages((prev) => [...prev, {
            id: Date.now().toString(),
            role: 'assistant',
            content: data.content
          }])
          setStreamingContent('')
          setIsLoading(false)
          break
        case 'thinking':
          setMessages((prev) => {
            const last = prev[prev.length - 1]
            if (last && last.role === 'thinking') {
              return [...prev.slice(0, -1), {
                ...last,
                content: last.content + data.content
              }]
            }
            return [...prev, {
              id: Date.now().toString(),
              role: 'thinking',
              content: data.content
            }]
          })
          break
        case 'tool_call':
          setMessages((prev) => [...prev, {
            id: Date.now().toString(),
            role: 'tool_call',
            content: '',
            metadata: {
              tool_name: data.tool_name,
              arguments: data.arguments
            }
          }])
          break
        case 'tool_result':
          setMessages((prev) => [...prev, {
            id: Date.now().toString(),
            role: 'tool_result',
            content: data.output || '',
            metadata: {
              tool_call_id: data.tool_call_id,
              output: data.output
            }
          }])
          break
        case 'approval':
          setMessages((prev) => [...prev, {
            id: Date.now().toString(),
            role: 'approval',
            content: `Approved: ${data.action}`,
            metadata: {
              action: data.action,
              description: data.description
            }
          }])
          break
        case 'status':
          setStatusInfo({
            context_usage: data.context_usage,
            token_usage: data.token_usage
          })
          break
        case 'error':
          setMessages((prev) => [...prev, {
            id: Date.now().toString(),
            role: 'error',
            content: data.message || 'An error occurred'
          }])
          setIsLoading(false)
          break
      }
    }

    ws.onclose = () => {
      setIsConnected(false)
    }

    ws.onerror = () => {
      setIsConnected(false)
    }

    return () => {
      ws.close()
    }
  }, [convId])

  const createConversation = async () => {
    try {
      const res = await fetch('/api/conversations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: 'New Conversation' })
      })
      const data = await res.json()
      if (data.conversation) {
        setConversations((prev) => [data.conversation, ...prev])
        setSearchParams({ id: data.conversation.id })
      }
    } catch (err) {
      console.error('Failed to create conversation:', err)
    }
  }

  const deleteConversation = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation()
    if (!confirm('Are you sure you want to delete this conversation?')) return

    try {
      await fetch(`/api/conversations/${id}`, { method: 'DELETE' })
      setConversations((prev) => prev.filter((c) => c.id !== id))
      if (convId === id) {
        setSearchParams({})
        setMessages([])
      }
    } catch (err) {
      console.error('Failed to delete conversation:', err)
    }
  }

  const startEditTitle = (conv: Conversation, e: React.MouseEvent) => {
    e.stopPropagation()
    setEditingId(conv.id)
    setEditTitle(conv.title)
  }

  const saveTitle = async (id: string) => {
    try {
      await fetch(`/api/conversations/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: editTitle })
      })
      setConversations((prev) => prev.map((c) => 
        c.id === id ? { ...c, title: editTitle } : c
      ))
    } catch (err) {
      console.error('Failed to update title:', err)
    }
    setEditingId(null)
  }

  const cancelEdit = () => {
    setEditingId(null)
    setEditTitle('')
  }

  // Upload file to backend
  const uploadFile = async (file: File): Promise<UploadedFile | null> => {
    if (!convId) return null
    
    const formData = new FormData()
    formData.append('file', file)
    
    try {
      const res = await fetch(`/api/conversations/${convId}/upload`, {
        method: 'POST',
        body: formData
      })
      
      if (!res.ok) {
        throw new Error(`Upload failed: ${res.statusText}`)
      }
      
      const data = await res.json()
      return { url: data.url, filename: data.filename }
    } catch (err) {
      console.error('Failed to upload file:', err)
      return null
    }
  }

  const handleSend = async () => {
    if ((!input.trim() && attachments.length === 0) || !wsRef.current || !isConnected) return

    setIsLoading(true)
    
    // Upload any pending image attachments first
    const uploadedAttachments: { type: string; url: string; filename: string; mediaType: string }[] = []
    
    for (const attachment of attachments) {
      if (attachment.type === 'image' && attachment.file && !attachment.uploadedUrl) {
        const uploaded = await uploadFile(attachment.file)
        if (uploaded) {
          uploadedAttachments.push({
            type: 'image_url',
            url: uploaded.url,
            filename: uploaded.filename,
            mediaType: attachment.mediaType
          })
          attachment.uploadedUrl = uploaded.url
        }
      } else if (attachment.uploadedUrl) {
        uploadedAttachments.push({
          type: attachment.type === 'image' ? 'image_url' : 'file',
          url: attachment.uploadedUrl,
          filename: attachment.filename,
          mediaType: attachment.mediaType
        })
      }
    }
    
    wsRef.current.send(JSON.stringify({ 
      message: input,
      thinking: thinkingEnabled,
      model: selectedModel,
      attachments: uploadedAttachments.length > 0 ? uploadedAttachments : undefined
    }))
    
    setInput('')
    setAttachments([])
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto'
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
    if (e.key === 'Backspace' && input === '' && attachments.length > 0) {
      e.preventDefault()
      setAttachments((prev) => prev.slice(0, -1))
    }
  }

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (!files) return

    Array.from(files).forEach((file) => {
      const url = URL.createObjectURL(file)
      const isImage = file.type.startsWith('image/')
      setAttachments((prev) => [...prev, {
        id: Math.random().toString(36).slice(2),
        type: isImage ? 'image' : 'file',
        url,
        mediaType: file.type,
        filename: file.name,
        file: file
      }])
    })
    
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  const removeAttachment = (id: string) => {
    setAttachments((prev) => {
      const found = prev.find((a) => a.id === id)
      if (found?.url) {
        URL.revokeObjectURL(found.url)
      }
      return prev.filter((a) => a.id !== id)
    })
  }

  const selectConversation = async (id: string) => {
    setStreamingContent('')
    setSearchParams({ id })
    setMessages([])
    setStatusInfo({ context_usage: null, token_usage: null })
    setAttachments([])
    
    // Load conversation history
    try {
      const res = await fetch(`/api/conversations/${id}/history`)
      const data = await res.json()
      if (data.messages) {
        const historyMessages: Message[] = []
        let msgIndex = 0
        for (const msg of data.messages) {
          const baseId = `hist-${msgIndex}`
          if (msg.type === 'user') {
            historyMessages.push({
              id: baseId,
              role: 'user',
              content: msg.content
            })
          } else if (msg.type === 'assistant') {
            historyMessages.push({
              id: baseId,
              role: 'assistant',
              content: msg.content
            })
            // Add thinking if present
            if (msg.thinking) {
              historyMessages.push({
                id: `${baseId}-think`,
                role: 'thinking',
                content: msg.thinking
              })
            }
          } else if (msg.type === 'tool_result') {
            historyMessages.push({
              id: baseId,
              role: 'tool_result',
              content: msg.output,
              metadata: {
                tool_call_id: msg.tool_call_id,
                output: msg.output
              }
            })
          }
          msgIndex++
        }
        setMessages(historyMessages)
      }
    } catch (err) {
      console.error('Failed to load history:', err)
    }
  }

  const formatTime = (isoString: string) => {
    const date = new Date(isoString)
    return date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  }

  const formatContextUsage = () => {
    const usage = statusInfo.context_usage
    if (usage === null) return '--'
    return `${Math.round(usage * 100)}%`
  }

  const currentConv = conversations.find(c => c.id === convId)

  // Toggle thinking block expansion
  const toggleThinkExpanded = (id: string) => {
    setExpandedThink((prev) => {
      const newSet = new Set(prev)
      if (newSet.has(id)) {
        newSet.delete(id)
      } else {
        newSet.add(id)
      }
      return newSet
    })
  }

  // Toggle tool block expansion
  const toggleToolExpanded = (id: string) => {
    setExpandedTool((prev) => {
      const newSet = new Set(prev)
      if (newSet.has(id)) {
        newSet.delete(id)
      } else {
        newSet.add(id)
      }
      return newSet
    })
  }

  // Check if a thinking block is currently streaming (last thinking message while loading)
  const isThinkingActive = (index: number): boolean => {
    return isLoading && index === messages.length - 1 && messages[index]?.role === 'thinking'
  }

  // Render message components based on kimi-cli style
  const renderUserMessage = (msg: Message) => (
    <div key={msg.id} className="flex justify-end">
      <div className="max-w-[80%] rounded-2xl bg-secondary/80 dark:bg-secondary/50 px-4 py-3 text-sm">
        <div className="whitespace-pre-wrap break-words">{msg.content}</div>
      </div>
    </div>
  )

  const renderAssistantMessage = (msg: Message) => (
    <div key={msg.id} className="flex justify-start">
      <div className="max-w-[85%]">
        <div className="whitespace-pre-wrap text-sm leading-relaxed">{msg.content}</div>
      </div>
    </div>
  )

  const renderThinkingBlock = (msg: Message, index: number) => {
    const isExpanded = blocksExpanded || expandedThink.has(msg.id)
    const isActive = isThinkingActive(index)
    
    return (
      <div key={msg.id} className="flex justify-start">
        <div className="max-w-[90%] w-full rounded-lg border border-amber-200 dark:border-amber-800/60 bg-amber-50/50 dark:bg-amber-950/10 overflow-hidden">
          <button
            onClick={() => toggleThinkExpanded(msg.id)}
            className="w-full flex items-center gap-2 px-3 py-2 text-xs font-medium text-amber-700 dark:text-amber-400 hover:bg-amber-100/50 dark:hover:bg-amber-900/20 transition-colors"
          >
            {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
            <Brain size={14} />
            <span>Thinking...</span>
            {isActive && <Loader2 size={12} className="animate-spin ml-1" />}
          </button>
          {isExpanded && (
            <div className="px-3 pb-3 text-xs text-amber-800 dark:text-amber-300/80 whitespace-pre-wrap font-mono leading-relaxed">
              {msg.content}
            </div>
          )}
        </div>
      </div>
    )
  }

  const renderToolCall = (msg: Message) => {
    const isExpanded = blocksExpanded || expandedTool.has(msg.id)
    const toolName = msg.metadata?.tool_name || 'unknown'
    
    return (
      <div key={msg.id} className="flex justify-start">
        <div className="max-w-[90%] w-full rounded-lg border border-blue-200 dark:border-blue-800/60 bg-blue-50/50 dark:bg-blue-950/10 overflow-hidden">
          <button
            onClick={() => toggleToolExpanded(msg.id)}
            className="w-full flex items-center gap-2 px-3 py-2 text-xs font-medium text-blue-700 dark:text-blue-400 hover:bg-blue-100/50 dark:hover:bg-blue-900/20 transition-colors"
          >
            {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
            <Wrench size={14} />
            <span>Using {toolName}</span>
          </button>
          {isExpanded && msg.metadata?.arguments && (
            <div className="px-3 pb-3">
              <pre className="text-xs text-blue-800 dark:text-blue-300/80 whitespace-pre-wrap font-mono bg-blue-100/50 dark:bg-blue-900/20 p-2 rounded">
                {JSON.stringify(msg.metadata.arguments, null, 2)}
              </pre>
            </div>
          )}
        </div>
      </div>
    )
  }

  const renderToolResult = (msg: Message) => (
    <div key={msg.id} className="flex justify-start">
      <div className="max-w-[90%] w-full rounded-lg border border-green-200 dark:border-green-800/60 bg-green-50/50 dark:bg-green-950/10 px-3 py-2">
        <div className="flex items-center gap-2 text-xs font-medium text-green-700 dark:text-green-400 mb-1">
          <CheckCircle2 size={12} />
          <span>Result</span>
        </div>
        <div className="text-xs text-green-800 dark:text-green-300/80 whitespace-pre-wrap font-mono leading-relaxed">
          {msg.content}
        </div>
      </div>
    </div>
  )

  const renderError = (msg: Message) => (
    <div key={msg.id} className="flex justify-start">
      <div className="max-w-[80%] px-4 py-3 rounded-lg text-sm bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800/60 text-red-800 dark:text-red-300">
        <div className="flex items-center gap-2 mb-1">
          <AlertCircle size={14} />
          <span className="font-medium">Error</span>
        </div>
        <div className="whitespace-pre-wrap">{msg.content}</div>
      </div>
    </div>
  )

  const renderApproval = (msg: Message) => (
    <div key={msg.id} className="flex justify-start">
      <div className="max-w-[80%] px-3 py-2 rounded-lg border border-purple-200 dark:border-purple-800/60 bg-purple-50/50 dark:bg-purple-950/10">
        <div className="flex items-center gap-2 text-xs font-medium text-purple-700 dark:text-purple-400">
          <CheckCircle2 size={12} />
          <span>{msg.content}</span>
        </div>
      </div>
    </div>
  )

  // Group messages for display
  const renderMessages = () => {
    const elements: JSX.Element[] = []
    
    for (let i = 0; i < messages.length; i++) {
      const msg = messages[i]
      
      switch (msg.role) {
        case 'user':
          elements.push(renderUserMessage(msg))
          break
        case 'assistant':
          elements.push(renderAssistantMessage(msg))
          break
        case 'thinking':
          elements.push(renderThinkingBlock(msg, i))
          break
        case 'tool_call':
          elements.push(renderToolCall(msg))
          break
        case 'tool_result':
          elements.push(renderToolResult(msg))
          break
        case 'error':
          elements.push(renderError(msg))
          break
        case 'approval':
          elements.push(renderApproval(msg))
          break
      }
    }
    
    return elements
  }

  return (
    <div className="h-full flex bg-background">
      {/* Sidebar */}
      <div className={clsx(
        'border-r border-border bg-background flex flex-col transition-all duration-200',
        showSidebar ? 'w-64' : 'w-0 overflow-hidden'
      )}>
        {/* Sidebar Header */}
        <div className="p-3 border-b border-border">
          <button
            onClick={createConversation}
            className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors text-sm font-medium"
          >
            <Plus size={16} />
            <span>New Chat</span>
          </button>
        </div>

        {/* Conversations List */}
        <div className="flex-1 overflow-y-auto p-2 space-y-1">
          {conversations.map((conv) => (
            <div
              key={conv.id}
              onClick={() => selectConversation(conv.id)}
              className={clsx(
                'group flex items-center gap-2 px-3 py-2 rounded-lg cursor-pointer transition-colors',
                convId === conv.id
                  ? 'bg-secondary/60'
                  : 'hover:bg-secondary/40'
              )}
            >
              <MessageSquare size={16} className="text-muted-foreground shrink-0" />
              
              <div className="flex-1 min-w-0">
                {editingId === conv.id ? (
                  <div className="flex items-center gap-1">
                    <input
                      type="text"
                      value={editTitle}
                      onChange={(e) => setEditTitle(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') saveTitle(conv.id)
                        if (e.key === 'Escape') cancelEdit()
                      }}
                      onClick={(e) => e.stopPropagation()}
                      className="flex-1 min-w-0 px-1 py-0.5 text-sm bg-background border border-primary rounded"
                      autoFocus
                    />
                    <button
                      onClick={(e) => { e.stopPropagation(); saveTitle(conv.id); }}
                      className="p-0.5 text-primary hover:bg-secondary/60 rounded"
                    >
                      <Check size={14} />
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); cancelEdit(); }}
                      className="p-0.5 text-muted-foreground hover:bg-secondary/60 rounded"
                    >
                      <X size={14} />
                    </button>
                  </div>
                ) : (
                  <>
                    <p className="text-sm font-medium truncate">{conv.title}</p>
                    <p className="text-xs text-muted-foreground truncate">
                      {formatTime(conv.updated_at)}
                    </p>
                  </>
                )}
              </div>

              {editingId !== conv.id && (
                <div className="hidden group-hover:flex items-center gap-1">
                  <button
                    onClick={(e) => startEditTitle(conv, e)}
                    className="p-1 text-muted-foreground hover:text-foreground hover:bg-secondary/60 rounded"
                  >
                    <Edit2 size={12} />
                  </button>
                  <button
                    onClick={(e) => deleteConversation(conv.id, e)}
                    className="p-1 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded"
                  >
                    <Trash2 size={12} />
                  </button>
                </div>
              )}
            </div>
          ))}

          {conversations.length === 0 && (
            <div className="text-center py-8 text-muted-foreground text-sm">
              No conversations yet
              <br />
              Click "New Chat" to start
            </div>
          )}
        </div>
      </div>

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Chat Header - Kimi CLI Style */}
        <div className="flex min-w-0 flex-col gap-2 px-3 py-2 sm:flex-row sm:items-center sm:justify-between sm:px-5 sm:py-3 lg:pl-8 border-b border-border">
          <div className="flex min-w-0 items-center gap-2">
            <button
              type="button"
              aria-label="Open sessions sidebar"
              className="inline-flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-secondary/60 hover:text-foreground lg:hidden"
              onClick={() => setShowSidebar(true)}
            >
              <PanelLeftOpen className="size-4" />
            </button>
            <div className="min-w-0 flex-1">
              {currentConv ? (
                <button
                  type="button"
                  className="truncate text-xs font-bold cursor-pointer hover:text-primary text-left bg-transparent border-none p-0"
                >
                  {currentConv.title}
                </button>
              ) : null}
            </div>
          </div>
          
          <div className="flex items-center justify-end gap-2">
            {convId && (
              <>
                {/* Context Usage */}
                <div className="relative">
                  <button className="flex items-center gap-1.5 text-xs text-muted-foreground select-none hover:text-foreground transition-colors">
                    <span>{formatContextUsage()} context</span>
                    <Info className="size-3" />
                  </button>
                </div>

                {/* Search Button */}
                <button
                  type="button"
                  aria-label="Search messages"
                  className="inline-flex items-center cursor-pointer justify-center rounded-md p-2 text-muted-foreground transition-colors hover:bg-secondary/60 hover:text-foreground"
                >
                  <Search className="size-4" />
                </button>

                {/* Toggle Blocks Button */}
                <button
                  type="button"
                  aria-label={blocksExpanded ? "Fold all blocks" : "Unfold all blocks"}
                  className="inline-flex items-center cursor-pointer justify-center rounded-md p-2 text-muted-foreground transition-colors hover:bg-secondary/60 hover:text-foreground"
                  onClick={() => setBlocksExpanded(!blocksExpanded)}
                >
                  {blocksExpanded ? (
                    <ChevronsDownUp className="size-4" />
                  ) : (
                    <ChevronsUpDown className="size-4" />
                  )}
                </button>
              </>
            )}
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {!convId ? (
            <div className="h-full flex flex-col items-center justify-center text-muted-foreground">
              <div className="w-16 h-16 bg-primary/10 rounded-2xl flex items-center justify-center mb-4">
                <MessageSquare size={32} className="text-primary" />
              </div>
              <p className="text-lg font-medium">Welcome to Legion Chat</p>
              <p className="text-sm mt-2">Select a conversation or create a new one</p>
              <button
                onClick={createConversation}
                className="mt-6 flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors"
              >
                <Plus size={16} />
                <span>New Chat</span>
              </button>
            </div>
          ) : messages.length === 0 && !streamingContent ? (
            <div className="h-full flex flex-col items-center justify-center text-muted-foreground">
              <p className="text-sm">Start a new conversation</p>
            </div>
          ) : (
            <>
              {renderMessages()}
              {/* Streaming content */}
              {streamingContent && (
                <div className="flex justify-start">
                  <div className="max-w-[85%]">
                    <div className="whitespace-pre-wrap text-sm leading-relaxed">
                      {streamingContent}
                    </div>
                  </div>
                </div>
              )}
            </>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input Area - Kimi CLI Style */}
        <div className="w-full px-2 sm:px-4 pb-4">
          {/* Attachments Preview */}
          {attachments.length > 0 && (
            <div className="flex flex-wrap gap-2 mb-2 px-1">
              {attachments.map((file) => (
                <div
                  key={file.id}
                  className="group relative flex items-center gap-1.5 px-2 py-1.5 rounded-lg border border-border bg-background text-xs"
                >
                  {file.type === 'image' ? (
                    <img src={file.url} alt="" className="w-6 h-6 rounded object-cover" />
                  ) : (
                    <Paperclip size={14} className="text-muted-foreground" />
                  )}
                  <span className="truncate max-w-[120px]">{file.filename}</span>
                  <button
                    onClick={() => removeAttachment(file.id)}
                    className="p-0.5 hover:bg-secondary/60 rounded opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <X size={12} />
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Input Container */}
          <div className="w-full border border-border rounded-2xl overflow-hidden bg-background shadow-sm">
            {/* Text Input */}
            <textarea
              ref={textareaRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={
                !convId
                  ? "Create a session to start..."
                  : !isConnected
                    ? "Connecting to environment..."
                    : "What would you like to know?"
              }
              disabled={!convId || isLoading || !isConnected}
              rows={1}
              className="w-full bg-transparent border-none px-4 py-3 text-sm resize-none focus:outline-none focus:ring-0 disabled:opacity-50 disabled:cursor-not-allowed min-h-[64px] max-h-[200px] field-sizing-content"
            />

            {/* Footer Toolbar - Kimi CLI Style */}
            <div className="flex items-center justify-between px-2 pb-2">
              {/* Left Tools */}
              <div className="flex items-center gap-1">
                {/* File Upload */}
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleFileSelect}
                  multiple
                  accept="image/*,.txt,.md,.json,.csv,.py,.js,.ts,.tsx,.html,.css,.yaml,.yml,.xml,.pdf"
                  className="hidden"
                />
                <button
                  onClick={() => fileInputRef.current?.click()}
                  disabled={!convId || isLoading}
                  className="inline-flex items-center justify-center rounded-md p-2 text-muted-foreground transition-colors hover:bg-secondary/60 hover:text-foreground disabled:opacity-50"
                  aria-label="Attach files"
                  title="Attach files"
                >
                  <Paperclip className="size-4" />
                </button>

                <div className="mx-0.5 h-4 w-px bg-border/70" />

                {/* Model Selector */}
                <div className="relative">
                  <button
                    onClick={() => setShowModelSelector(!showModelSelector)}
                    disabled={!convId || isLoading}
                    className="inline-flex h-9 max-w-[160px] items-center justify-start gap-2 border-0 px-2 text-xs font-medium text-muted-foreground transition-colors hover:bg-secondary/60 hover:text-foreground disabled:opacity-50"
                  >
                    <Cpu className="size-4 shrink-0" />
                    <span className="truncate">{selectedModel}</span>
                  </button>
                  
                  {/* Model Dropdown */}
                  {showModelSelector && (
                    <>
                      <div 
                        className="fixed inset-0 z-40" 
                        onClick={() => setShowModelSelector(false)}
                      />
                      <div className="absolute bottom-full left-0 mb-1 w-64 bg-background border border-border rounded-lg shadow-lg z-50 py-1">
                        <div className="px-3 py-2 text-xs font-medium text-muted-foreground border-b border-border">
                          Select model
                        </div>
                        <div className="max-h-64 overflow-y-auto">
                          {models.map((model) => {
                            const isSelected = model.id === selectedModel
                            return (
                              <button
                                key={model.id}
                                onClick={() => {
                                  setSelectedModel(model.id)
                                  setShowModelSelector(false)
                                }}
                                className={clsx(
                                  'w-full flex items-center gap-2 px-3 py-2 text-xs text-left hover:bg-secondary/60 transition-colors',
                                  isSelected && 'bg-primary/10 text-primary'
                                )}
                              >
                                {isSelected ? (
                                  <Check className="size-4" />
                                ) : (
                                  <span className="size-4" />
                                )}
                                <span className="flex-1 truncate">{model.name}</span>
                                <span className="shrink-0 text-xs text-muted-foreground">
                                  {model.provider}
                                </span>
                              </button>
                            )
                          })}
                        </div>
                      </div>
                    </>
                  )}
                </div>

                <div className="mx-0.5 h-4 w-px bg-border/70" />

                {/* Thinking Toggle */}
                <div className="flex h-9 items-center gap-2 rounded-md px-2">
                  <span className="text-xs text-muted-foreground">Thinking</span>
                  <button
                    onClick={() => setThinkingEnabled(!thinkingEnabled)}
                    disabled={!convId || isLoading}
                    className={clsx(
                      'relative inline-flex h-5 w-9 items-center rounded-full transition-colors disabled:opacity-50',
                      thinkingEnabled ? 'bg-primary' : 'bg-input'
                    )}
                    aria-label={thinkingEnabled ? 'Disable thinking' : 'Enable thinking'}
                  >
                    <span
                      className={clsx(
                        'inline-block h-3.5 w-3.5 transform rounded-full bg-background transition-transform',
                        thinkingEnabled ? 'translate-x-5' : 'translate-x-1'
                      )}
                    />
                  </button>
                </div>
              </div>

              {/* Right Tools */}
              <div className="flex items-center gap-2">
                {/* Context Usage Display */}
                <div className="hidden sm:flex items-center gap-1.5 text-xs text-muted-foreground mr-2">
                  <span>{formatContextUsage()} context</span>
                </div>
                
                {isLoading ? (
                  <button
                    onClick={() => {}}
                    className="inline-flex size-9 items-center justify-center rounded-md bg-primary text-primary-foreground transition-colors hover:bg-primary/90"
                    aria-label="Stop generation"
                  >
                    <Square className="size-4" />
                  </button>
                ) : (
                  <button
                    onClick={handleSend}
                    disabled={!convId || isLoading || (!input.trim() && attachments.length === 0)}
                    className="inline-flex size-9 items-center justify-center rounded-md bg-primary text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed"
                    aria-label="Submit"
                  >
                    <CornerDownLeft className="size-4" />
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
