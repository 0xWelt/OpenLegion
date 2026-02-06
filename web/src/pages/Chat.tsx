import { useEffect, useRef, useState, useCallback, memo } from 'react'
import { useSearchParams } from 'react-router-dom'
import clsx from 'clsx'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import remarkMath from 'remark-math'
import rehypeKatex from 'rehype-katex'
import 'katex/dist/katex.min.css'
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter'
import { oneDark, oneLight } from 'react-syntax-highlighter/dist/esm/styles/prism'
import {
  Check,
  Paperclip,
  X,
  Loader2,
  ChevronDown,
  ChevronRight,
  Wrench,
  Brain,
  CheckCircle2,
  AlertCircle,
  Cpu,
  Search,
  ChevronsDownUp,
  ChevronsUpDown,
  Square,
  CornerDownLeft,
  MessageSquare,
  Plus,
  Copy,


  Sparkles,
  Bot
} from 'lucide-react'

// =============================================================================
// TYPES
// =============================================================================

// Part types for streaming assistant messages
type MessagePart =
  | { type: 'thinking'; content: string; isActive?: boolean }
  | { type: 'tool_call'; tool_name: string; tool_call_id?: string; arguments?: string | Record<string, unknown>; isActive?: boolean }
  | { type: 'tool_result'; tool_call_id?: string; output: string }
  | { type: 'text'; content: string }

interface Message {
  id: string
  role: 'user' | 'assistant' | 'error' | 'approval' | 'tool_result'
  content: string
  // For streaming assistant messages, track parts in order
  parts?: MessagePart[]
  // For role === 'tool_result'
  tool_call_id?: string
  output?: string
}

interface UploadedFile {
  url: string
  filename: string
}

interface Attachment {
  id: string
  type: 'image' | 'file'
  url: string
  filename: string
  mediaType: string
  file?: File
  uploadedUrl?: string
}

interface Model {
  id: string
  name: string
  provider: string
  description?: string
  capabilities?: string[]
}

interface KimiConfig {
  default_model: string
  default_thinking: boolean
  models: Record<string, {
    provider: string
    model?: string
    max_context_size?: number
    capabilities?: string[]
  }>
  providers: Record<string, {
    type: string
    base_url?: string
  }>
}

// =============================================================================
// UTILITIES
// =============================================================================

const formatDuration = (ms: number): string => {
  if (ms < 1000) return `${ms}ms`
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`
  return `${(ms / 60000).toFixed(1)}m`
}

// =============================================================================
// COMPONENTS
// =============================================================================

// Hook to detect dark mode changes
const useDarkMode = () => {
  const [isDark, setIsDark] = useState(() => document.documentElement.classList.contains('dark'))

  useEffect(() => {
    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        if (mutation.attributeName === 'class') {
          setIsDark(document.documentElement.classList.contains('dark'))
        }
      })
    })

    observer.observe(document.documentElement, { attributes: true })
    return () => observer.disconnect()
  }, [])

  return isDark
}

// Code block with copy button in top-right corner
const CodeBlock = memo(({ code, language }: { code: string; language?: string }) => {
  const [copied, setCopied] = useState(false)
  const isDark = useDarkMode()

  const handleCopy = async () => {
    await navigator.clipboard.writeText(code)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="relative group my-2">
      <button
        onClick={handleCopy}
        className="absolute top-2 right-2 z-10 p-1.5 rounded bg-black/20 hover:bg-black/30 dark:bg-white/10 dark:hover:bg-white/20 transition-colors opacity-0 group-hover:opacity-100"
        title="Copy code"
      >
        {copied ? <Check className="w-3.5 h-3.5 text-green-400" /> : <Copy className="w-3.5 h-3.5 text-white/70" />}
      </button>
      <div className="rounded-lg overflow-hidden border border-border">
        <SyntaxHighlighter
          language={language || 'text'}
          style={isDark ? oneDark : oneLight}
          customStyle={{ margin: 0, borderRadius: 0, fontSize: '0.875rem' }}
          showLineNumbers
        >
          {code}
        </SyntaxHighlighter>
      </div>
    </div>
  )
})

// Markdown renderer with math support
const MarkdownContent = memo(({ content }: { content: string }) => {
  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm, remarkMath]}
      rehypePlugins={[rehypeKatex]}
      components={{
        code({ node, inline, className, children, ...props }: any) {
          const match = /language-(\w+)/.exec(className || '')
          const code = String(children).replace(/\n$/, '')

          // Check if this is inline code:
          // 1. explicit inline flag from react-markdown
          // 2. no language class (inline code doesn't have language-xxx class)
          // 3. no newlines in content
          const isInline = inline || (!match && !code.includes('\n'))

          if (isInline) {
            return (
              <code
                className="px-1.5 py-0.5 rounded font-mono text-sm bg-oc-surface text-oc-text border border-oc-border"
                {...props}
              >
                {children}
              </code>
            )
          }

          return <CodeBlock code={code} language={match?.[1]} />
        },
        pre({ children }) {
          return <>{children}</>
        },
        p({ children }) {
          return <p className="mb-4 last:mb-0 leading-relaxed">{children}</p>
        },
        ul({ children }) {
          return <ul className="list-disc pl-6 mb-4 space-y-1">{children}</ul>
        },
        ol({ children }) {
          return <ol className="list-decimal pl-6 mb-4 space-y-1">{children}</ol>
        },
        li({ children }) {
          return <li className="leading-relaxed">{children}</li>
        },
        h1({ children }) {
          return <h1 className="text-2xl font-bold mb-4 mt-6">{children}</h1>
        },
        h2({ children }) {
          return <h2 className="text-xl font-bold mb-3 mt-5">{children}</h2>
        },
        h3({ children }) {
          return <h3 className="text-lg font-bold mb-2 mt-4">{children}</h3>
        },
        blockquote({ children }) {
          return (
            <blockquote className="border-l-2 border-primary pl-4 italic text-muted-foreground my-4">
              {children}
            </blockquote>
          )
        },
        table({ children }) {
          return (
            <div className="overflow-x-auto my-4">
              <table className="w-full border-collapse border border-border">
                {children}
              </table>
            </div>
          )
        },
        thead({ children }) {
          return <thead className="bg-muted">{children}</thead>
        },
        th({ children }) {
          return (
            <th className="border border-border px-3 py-2 text-left font-semibold text-sm">
              {children}
            </th>
          )
        },
        td({ children }) {
          return (
            <td className="border border-border px-3 py-2 text-sm">
              {children}
            </td>
          )
        },
        a({ href, children }) {
          return (
            <a
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary hover:underline"
            >
              {children}
            </a>
          )
        },
      }}
    >
      {content}
    </ReactMarkdown>
  )
})

// Attachment preview
const AttachmentPreview = memo(({ attachment, onRemove }: { attachment: Attachment; onRemove: () => void }) => {
  return (
    <div className="group relative flex items-center gap-2 px-2 py-1.5 rounded-lg border border-border bg-muted/50 text-xs">
      {attachment.type === 'image' ? (
        <div className="relative">
          <img src={attachment.url} alt="" className="w-8 h-8 rounded object-cover" />
        </div>
      ) : (
        <Paperclip className="w-4 h-4 text-muted-foreground" />
      )}
      <span className="truncate max-w-[120px] text-muted-foreground">{attachment.filename}</span>
      <button
        onClick={onRemove}
        className="p-0.5 rounded-full hover:bg-muted transition-colors"
      >
        <X className="w-3 h-3 text-muted-foreground" />
      </button>
    </div>
  )
})

// Model Selector Modal - Centered modal like kimi-cli
const ModelSelectorModal = memo(({
  isOpen,
  onClose,
  models,
  selectedModel,
  onSelect
}: {
  isOpen: boolean
  onClose: () => void
  models: Model[]
  selectedModel: string
  onSelect: (modelId: string) => void
}) => {
  const [searchQuery, setSearchQuery] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  // Focus input when modal opens
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 100)
    }
  }, [isOpen])

  // Close on escape
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    if (isOpen) {
      document.addEventListener('keydown', handleEscape)
      return () => document.removeEventListener('keydown', handleEscape)
    }
  }, [isOpen, onClose])

  if (!isOpen) return null

  const filteredModels = searchQuery
    ? models.filter(m =>
        m.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
        m.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        m.provider.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : models

  // Group models by provider
  const groupedModels = filteredModels.reduce((acc, model) => {
    const provider = model.provider
    if (!acc[provider]) acc[provider] = []
    acc[provider].push(model)
    return acc
  }, {} as Record<string, Model[]>)

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="w-full max-w-2xl max-h-[80vh] flex flex-col bg-background rounded-xl border border-border shadow-2xl overflow-hidden">
        {/* Header with search */}
        <div className="p-4 border-b border-border">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold">Select Model</h2>
            <button
              onClick={onClose}
              className="p-2 text-muted-foreground hover:text-foreground hover:bg-muted rounded-lg transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input
              ref={inputRef}
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search models..."
              className="w-full pl-10 pr-4 py-2 bg-muted rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
            />
          </div>
        </div>

        {/* Model list */}
        <div className="flex-1 overflow-y-auto p-2">
          {Object.entries(groupedModels).map(([provider, providerModels]) => (
            <div key={provider} className="mb-4">
              <div className="px-3 py-2 text-xs font-medium text-muted-foreground uppercase tracking-wider">
                {provider}
              </div>
              <div className="space-y-1">
                {providerModels.map((model) => (
                  <button
                    key={model.id}
                    onClick={() => {
                      onSelect(model.id)
                      onClose()
                    }}
                    className={clsx(
                      'w-full flex items-center gap-3 px-3 py-3 rounded-lg text-left transition-colors',
                      selectedModel === model.id
                        ? 'bg-primary/10 border border-primary/20'
                        : 'hover:bg-muted border border-transparent'
                    )}
                  >
                    <div className="flex-shrink-0">
                      {selectedModel === model.id ? (
                        <div className="w-5 h-5 rounded-full bg-primary flex items-center justify-center">
                          <Check className="w-3 h-3 text-primary-foreground" />
                        </div>
                      ) : (
                        <div className="w-5 h-5 rounded-full border-2 border-muted-foreground/30" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{model.name}</span>
                        {model.capabilities?.includes('thinking') && (
                          <span className="px-1.5 py-0.5 text-[10px] bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 rounded">
                            thinking
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-muted-foreground truncate">
                        {model.description || model.id}
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          ))}

          {filteredModels.length === 0 && (
            <div className="text-center py-8 text-muted-foreground">
              No models found matching "{searchQuery}"
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-3 border-t border-border bg-muted/30">
          <div className="text-xs text-muted-foreground text-center">
            Press <kbd className="px-1.5 py-0.5 bg-muted rounded text-xs">ESC</kbd> to close
          </div>
        </div>
      </div>
    </div>
  )
})

// =============================================================================
// MESSAGE RENDERERS - Aligned with kimi-cli
// =============================================================================

// User message bubble
const UserMessage = memo(({ content }: { content: string }) => (
  <div className="flex justify-end">
    <div className="max-w-[85%] rounded-2xl bg-primary text-primary-foreground px-4 py-3 text-sm">
      <div className="whitespace-pre-wrap break-words">{content}</div>
    </div>
  </div>
))

// Assistant message with parts (text, thinking, tool_call, tool_result) in order
const AssistantMessage = memo(({
  messageId,
  parts,
  isStreaming = false,
  expandedBlocks,
  onToggleBlock,
  thinkingDuration
}: {
  messageId: string
  parts?: MessagePart[]
  isStreaming?: boolean
  expandedBlocks: Set<string>
  onToggleBlock: (id: string) => void
  thinkingDuration?: number
}) => {
  return (
    <div className="flex justify-start w-full">
      <div className="w-full space-y-2">
        {/* Render all parts in order */}
        {parts?.map((part, index) => {
          const blockId = `${messageId}-part-${index}`
          const isExpanded = expandedBlocks.has(blockId)
          const isLastPart = index === parts.length - 1

          if (part.type === 'thinking') {
            return (
              <div key={blockId}>
                <button
                  onClick={() => onToggleBlock(blockId)}
                  className="flex items-center gap-2 text-xs text-amber-600 dark:text-amber-500 hover:text-amber-700 dark:hover:text-amber-400 transition-colors"
                >
                  {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                  {isStreaming && isLastPart && part.isActive ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>Thinking...</span>
                    </>
                  ) : (
                    <>
                      <Brain className="w-3.5 h-3.5" />
                      <span>Thinking{thinkingDuration && thinkingDuration > 0 ? ` (${formatDuration(thinkingDuration)})` : ''}</span>
                    </>
                  )}
                </button>
                {isExpanded && (
                  <div className="mt-2 pl-6 border-l-2 border-amber-300 dark:border-amber-700/50">
                    <div className="text-xs text-amber-700 dark:text-amber-400/80 whitespace-pre-wrap font-mono leading-relaxed">
                      {part.content}
                    </div>
                  </div>
                )}
              </div>
            )
          }

          if (part.type === 'tool_call') {
            // Format arguments for display based on type
            let argsDisplay: string
            if (part.arguments === undefined || part.arguments === null) {
              argsDisplay = 'No arguments'
            } else if (typeof part.arguments === 'string') {
              // Empty string is valid - tool might have no args, or still streaming
              argsDisplay = part.arguments.trim() || '(no arguments)'
            } else {
              argsDisplay = Object.keys(part.arguments).length > 0
                ? JSON.stringify(part.arguments, null, 2)
                : '(no arguments)'
            }
            const toolCallStreaming = isStreaming && isLastPart && part.isActive
            return (
              <div key={blockId}>
                <button
                  onClick={() => onToggleBlock(blockId)}
                  className="flex items-center gap-2 text-xs text-blue-600 dark:text-blue-500 hover:text-blue-700 dark:hover:text-blue-400 transition-colors"
                >
                  {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                  {toolCallStreaming ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>Calling ({part.tool_call_id ? formatToolCallIdDisplay(part.tool_call_id) : part.tool_name})...</span>
                    </>
                  ) : (
                    <>
                      <Wrench className="w-3.5 h-3.5" />
                      <span>Calling ({part.tool_call_id ? formatToolCallIdDisplay(part.tool_call_id) : part.tool_name})</span>
                    </>
                  )}
                </button>
                {isExpanded && (
                  <div className="mt-2 pl-6 border-l-2 border-blue-300 dark:border-blue-700/50">
                    <pre className="text-xs text-blue-700 dark:text-blue-400/80 whitespace-pre-wrap font-mono bg-blue-50/50 dark:bg-blue-900/20 p-2 rounded">
                      {argsDisplay}
                    </pre>
                  </div>
                )}
              </div>
            )
          }

          if (part.type === 'tool_result') {
            return (
              <div key={blockId}>
                <button
                  onClick={() => onToggleBlock(blockId)}
                  className="flex items-center gap-2 text-xs text-emerald-600 dark:text-emerald-500 hover:text-emerald-700 dark:hover:text-emerald-400 transition-colors"
                >
                  {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>Result</span>
                </button>
                {isExpanded && (
                  <div className="mt-2 pl-6 border-l-2 border-emerald-300 dark:border-emerald-700/50">
                    <div className="text-xs text-emerald-700 dark:text-emerald-400/80 whitespace-pre-wrap font-mono leading-relaxed">
                      {part.output}
                    </div>
                  </div>
                )}
              </div>
            )
          }

          if (part.type === 'text') {
            return <MarkdownContent key={blockId} content={part.content} />
          }

          return null
        })}
        {/* Waiting for tool result: last part is completed tool_call, result not yet received */}
        {isStreaming && parts?.length && (() => {
          const last = parts[parts.length - 1]
          if (last.type === 'tool_call' && !last.isActive) {
            const label = last.tool_call_id ? `Executing (${formatToolCallIdDisplay(last.tool_call_id)})` : 'Executing'
            return (
              <div key={`${messageId}-result-loading`} className="flex items-center gap-2 text-xs text-emerald-600 dark:text-emerald-500">
                <Loader2 className="w-3.5 h-3.5 animate-spin shrink-0" />
                <span>{label}</span>
              </div>
            )
          }
          return null
        })()}
      </div>
    </div>
  )
})



// Display tool_call_id with space after colon (e.g. Shell:8 -> Shell: 8)
function formatToolCallIdDisplay(id: string): string {
  return id.replace(/:(?=\d)/, ': ')
}

// Normalize tool result output to string (history uses string; live may receive string or object)
function formatToolResultOutput(value: string | Record<string, unknown> | null | undefined): string {
  if (value == null) return ''
  if (typeof value === 'string') return value
  if (typeof value === 'object') return JSON.stringify(value, null, 2)
  return String(value)
}

// Tool result as standalone message (same format for both history and live chat)
const ToolResultMessage = memo(({
  messageId,
  toolCallId,
  output,
  expandedBlocks,
  onToggleBlock
}: {
  messageId: string
  toolCallId?: string
  output: string | Record<string, unknown>
  expandedBlocks: Set<string>
  onToggleBlock: (id: string) => void
}) => {
  const blockId = `${messageId}-result`
  const isExpanded = expandedBlocks.has(blockId)
  const outputStr = formatToolResultOutput(output)
  return (
    <div className="flex justify-start w-full">
      <div className="w-full">
        <button
          onClick={() => onToggleBlock(blockId)}
          className="flex items-center gap-2 text-xs text-emerald-600 dark:text-emerald-500 hover:text-emerald-700 dark:hover:text-emerald-400 transition-colors"
        >
          {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
          <CheckCircle2 className="w-3.5 h-3.5" />
          <span>Result{toolCallId ? ` (${formatToolCallIdDisplay(toolCallId)})` : ''}</span>
        </button>
        {isExpanded && (
          <div className="mt-2 pl-6 border-l-2 border-emerald-300 dark:border-emerald-700/50">
            <div className="text-xs text-emerald-700 dark:text-emerald-400/80 whitespace-pre-wrap font-mono leading-relaxed">
              {outputStr}
            </div>
          </div>
        )}
      </div>
    </div>
  )
})

// Error message
const ErrorMessage = memo(({ content }: { content: string }) => (
  <div className="flex justify-start">
    <div className="max-w-[85%] px-4 py-3 rounded-lg text-sm bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800/40 text-red-800 dark:text-red-300">
      <div className="flex items-center gap-2 mb-1">
        <AlertCircle className="w-4 h-4" />
        <span className="font-medium">Error</span>
      </div>
      <div className="whitespace-pre-wrap">{content}</div>
    </div>
  </div>
))

// Approval message
const ApprovalMessage = memo(({ content }: { content: string }) => (
  <div className="flex justify-start">
    <div className="max-w-[85%] px-3 py-2 rounded-lg border border-purple-200 dark:border-purple-800/40 bg-purple-50/30 dark:bg-purple-950/10">
      <div className="flex items-center gap-2 text-xs font-medium text-purple-700 dark:text-purple-400">
        <CheckCircle2 className="w-3.5 h-3.5" />
        <span>{content}</span>
      </div>
    </div>
  </div>
))



// =============================================================================
// MAIN CHAT COMPONENT
// =============================================================================

export default function Chat() {
  const [searchParams, setSearchParams] = useSearchParams()
  const convId = searchParams.get('id')

  // State
  const [messages, setMessages] = useState<Message[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [input, setInput] = useState('')
  const [attachments, setAttachments] = useState<Attachment[]>([])
  const [isConnected, setIsConnected] = useState(false)
  const [statusInfo, setStatusInfo] = useState<{ context_usage: number | null; token_usage: number | null }>({
    context_usage: null,
    token_usage: null
  })
  const [thinkingEnabled, setThinkingEnabled] = useState(false)
  const [selectedModel, setSelectedModel] = useState('')
  const [showModelSelector, setShowModelSelector] = useState(false)
  const [expandedBlocks, setExpandedBlocks] = useState<Set<string>>(new Set())
  const [expandAll, setExpandAll] = useState(false)
  const [thinkingDuration] = useState<number>(0)
  const [models, setModels] = useState<Model[]>([])
  const [configLoaded, setConfigLoaded] = useState(false)
  // Track the currently streaming assistant message
  const streamingMsgIdRef = useRef<string | null>(null)

  // Refs
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const wsRef = useRef<WebSocket | null>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const messagesContainerRef = useRef<HTMLDivElement>(null)
  const scrollRestoredForConvRef = useRef<Set<string>>(new Set())
  const scrollSaveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const SCROLL_STORAGE_KEY = (id: string) => `chat-scroll-${id}`

  // Persist scroll position so hot reload doesn't jump to top
  const saveScrollPosition = useCallback(() => {
    const container = messagesContainerRef.current
    const id = searchParams.get('id')
    if (!container || !id) return
    const key = SCROLL_STORAGE_KEY(id)
    sessionStorage.setItem(key, String(container.scrollTop))
  }, [searchParams])

  useEffect(() => {
    const container = messagesContainerRef.current
    if (!container) return
    const onScroll = () => {
      if (scrollSaveTimeoutRef.current) clearTimeout(scrollSaveTimeoutRef.current)
      scrollSaveTimeoutRef.current = setTimeout(saveScrollPosition, 150)
    }
    container.addEventListener('scroll', onScroll, { passive: true })
    return () => {
      container.removeEventListener('scroll', onScroll)
      if (scrollSaveTimeoutRef.current) clearTimeout(scrollSaveTimeoutRef.current)
    }
  }, [saveScrollPosition, convId])

  // When switching conversation, allow restore again for the new conv
  useEffect(() => {
    scrollRestoredForConvRef.current.clear()
  }, [convId])

  // Restore scroll position after mount (e.g. after HMR) so we don't jump to top
  useEffect(() => {
    if (!convId || messages.length === 0) return
    if (scrollRestoredForConvRef.current.has(convId)) return
    const saved = sessionStorage.getItem(SCROLL_STORAGE_KEY(convId))
    if (saved === null) return
    scrollRestoredForConvRef.current.add(convId)
    const container = messagesContainerRef.current
    if (!container) return
    const value = parseInt(saved, 10)
    if (Number.isNaN(value)) return
    const restore = () => {
      if (messagesContainerRef.current) {
        messagesContainerRef.current.scrollTop = value
      }
    }
    requestAnimationFrame(restore)
  }, [convId, messages.length])

  // Smart scroll - only scroll if user is near bottom
  const scrollToBottom = useCallback(() => {
    const container = messagesContainerRef.current
    if (!container) return
    const isNearBottom = container.scrollHeight - container.scrollTop - container.clientHeight < 100
    if (isNearBottom) {
      container.scrollTop = container.scrollHeight
    }
  }, [])

  useEffect(() => {
    scrollToBottom()
  }, [messages, scrollToBottom])

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto'
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 200)}px`
    }
  }, [input])

  // Load config
  useEffect(() => {
    const loadConfig = async () => {
      try {
        const res = await fetch('/api/conversations/config')
        const data = await res.json()
        if (data.config) {
          const config: KimiConfig = data.config
          setThinkingEnabled(config.default_thinking)

          // Build model list from config
          if (config.models && Object.keys(config.models).length > 0) {
            const configModels: Model[] = Object.entries(config.models).map(([id, model]) => ({
              id,
              name: model.model || id,
              provider: model.provider || 'Unknown',
              description: model.max_context_size
                ? `Context: ${model.max_context_size.toLocaleString()}`
                : undefined,
              capabilities: model.capabilities
            }))
            setModels(configModels)

            // Set default model
            const defaultModelId = config.default_model
            const targetModel = configModels.find(m => m.id === defaultModelId) || configModels[0]
            if (targetModel) {
              setSelectedModel(targetModel.id)
            }
          }
        }
      } catch (err) {
        console.error('Failed to load config:', err)
      } finally {
        setConfigLoaded(true)
      }
    }
    loadConfig()
  }, [])

  // Load conversation
  const loadConversation = useCallback(async (id: string) => {
    streamingMsgIdRef.current = null
    setMessages([])
    setStatusInfo({ context_usage: null, token_usage: null })
    setAttachments([])

    try {
      const res = await fetch(`/api/conversations/${id}/history`)
      const data = await res.json()
      if (data.messages) {
        const historyMessages: Message[] = []
        let msgIndex = 0
        let currentAssistantMsg: Message | null = null

        for (const msg of data.messages) {
          const baseId = `hist-${msgIndex}`

          if (msg.type === 'user') {
            // Flush any pending assistant message
            if (currentAssistantMsg) {
              historyMessages.push(currentAssistantMsg)
              currentAssistantMsg = null
            }
            historyMessages.push({ id: baseId, role: 'user', content: msg.content })
          } else if (msg.type === 'assistant') {
            if (currentAssistantMsg) {
              historyMessages.push(currentAssistantMsg)
              currentAssistantMsg = null
            }
            // Order: thinking → text → tool_call (tool_result is a separate message)
            const parts: NonNullable<Message['parts']> = []
            if (msg.thinking) {
              parts.push({ type: 'thinking', content: msg.thinking })
            }
            if (msg.content?.trim()) {
              parts.push({ type: 'text', content: msg.content })
            }
            if (msg.tool_calls && msg.tool_calls.length > 0) {
              for (const tc of msg.tool_calls) {
                parts.push({
                  type: 'tool_call',
                  tool_name: tc.tool_name,
                  tool_call_id: tc.tool_call_id,
                  arguments: tc.arguments
                })
              }
            }
            currentAssistantMsg = {
              id: baseId,
              role: 'assistant',
              content: msg.content,
              parts
            }
          } else if (msg.type === 'tool_result') {
            if (currentAssistantMsg) {
              historyMessages.push(currentAssistantMsg)
              currentAssistantMsg = null
            }
            historyMessages.push({
              id: baseId,
              role: 'tool_result',
              content: '',
              tool_call_id: msg.tool_call_id,
              output: msg.output
            })
          }
          msgIndex++
        }

        // Flush final assistant message
        if (currentAssistantMsg) {
          historyMessages.push(currentAssistantMsg)
        }

        setMessages(historyMessages)
      }
    } catch (err) {
      console.error('Failed to load history:', err)
    }
  }, [])

  // Listen for conversation changes
  useEffect(() => {
    if (convId) {
      loadConversation(convId)
    } else {
      setMessages([])
      streamingMsgIdRef.current = null
      setStatusInfo({ context_usage: null, token_usage: null })
      setAttachments([])
    }
  }, [convId, loadConversation])

  // WebSocket connection
  useEffect(() => {
    if (!convId) {
      wsRef.current?.close()
      wsRef.current = null
      setIsConnected(false)
      return
    }

    const wsUrl = `${window.location.protocol === 'https:' ? 'wss:' : 'ws:'}//${window.location.host}/api/conversations/ws/${convId}`
    const ws = new WebSocket(wsUrl)

    ws.onopen = () => setIsConnected(true)

    // Helper to update or create streaming message
    const updateStreamingMessage = (
      updateFn: (parts: MessagePart[]) => MessagePart[],
      createNewPart?: MessagePart
    ) => {
      setMessages((prev) => {
        const streamingId = streamingMsgIdRef.current
        if (streamingId) {
          const msgIndex = prev.findIndex(m => m.id === streamingId)
          if (msgIndex >= 0) {
            const msg = prev[msgIndex]
            const currentParts = msg.parts || []
            const updatedParts = updateFn(currentParts)
            const updated = [...prev]
            updated[msgIndex] = { ...msg, parts: updatedParts }
            return updated
          }
        }
        // Create new streaming message
        const newId = `streaming-${Date.now()}`
        streamingMsgIdRef.current = newId
        return [...prev, {
          id: newId,
          role: 'assistant',
          content: '',
          parts: createNewPart ? [createNewPart] : []
        }]
      })
    }

    ws.onmessage = (event) => {
      const data = JSON.parse(event.data)

      switch (data.type) {
        case 'status':
          setStatusInfo({
            context_usage: data.context_usage ?? null,
            token_usage: data.token_usage ?? null
          })
          break

        case 'chunk':
          // Append text as a text part
          updateStreamingMessage(
            (parts) => {
              const lastPart = parts[parts.length - 1]
              if (lastPart?.type === 'text') {
                // Append to existing text part
                return [...parts.slice(0, -1), { ...lastPart, content: lastPart.content + data.content }]
              }
              // Add new text part
              return [...parts, { type: 'text', content: data.content }]
            },
            { type: 'text', content: data.content }
          )
          break

        case 'think':
          // Append to current thinking if active, otherwise create new one
          updateStreamingMessage(
            (parts) => {
              const lastPart = parts[parts.length - 1]
              if (lastPart?.type === 'thinking' && lastPart.isActive) {
                // Append to current thinking
                return [...parts.slice(0, -1), { ...lastPart, content: lastPart.content + data.content }]
              }
              // Mark all previous thinking as inactive and add new one
              const updatedParts = parts.map(p =>
                p.type === 'thinking' ? { ...p, isActive: false } : p
              )
              return [...updatedParts, { type: 'thinking', content: data.content, isActive: true }]
            },
            { type: 'thinking', content: data.content, isActive: true }
          )
          break

        case 'tool_call': {
          // Backend sends: type tool_call with arguments_raw (string); may be start of stream
          const initialArgs = data.arguments_raw ?? data.arguments ?? ''
          updateStreamingMessage(
            (parts) => {
              const lastPart = parts[parts.length - 1]
              if (lastPart?.type === 'tool_call' && lastPart.isActive && typeof lastPart.arguments === 'string' && typeof initialArgs === 'string') {
                return [...parts.slice(0, -1), { ...lastPart, arguments: lastPart.arguments + initialArgs }]
              }
              if (typeof data.arguments === 'object' && data.arguments !== null) {
                const updatedParts = parts.map(p =>
                  p.type === 'tool_call' && p.isActive ? { ...p, arguments: data.arguments, isActive: false } : p
                )
                return updatedParts
              }
              return [...parts, { type: 'tool_call', tool_name: data.tool_name ?? 'unknown', tool_call_id: data.tool_call_id, arguments: initialArgs, isActive: true }]
            },
            { type: 'tool_call', tool_name: data.tool_name ?? 'unknown', tool_call_id: data.tool_call_id, arguments: initialArgs, isActive: true }
          )
          break
        }

        case 'tool_call_chunk':
          // Append chunk to active tool_call arguments string
          updateStreamingMessage((parts) => {
            const lastPart = parts[parts.length - 1]
            if (lastPart?.type === 'tool_call' && lastPart.isActive) {
              const current = typeof lastPart.arguments === 'string' ? lastPart.arguments : ''
              return [...parts.slice(0, -1), { ...lastPart, arguments: current + (data.content ?? '') }]
            }
            return parts
          })
          break

        case 'tool_call_complete':
          // Stream ended; frontend parses accumulated string arguments to JSON
          updateStreamingMessage((parts) => {
            return parts.map(p => {
              if (p.type === 'tool_call' && p.isActive && typeof p.arguments === 'string') {
                try {
                  const parsed = JSON.parse(p.arguments)
                  return { ...p, arguments: parsed, isActive: false }
                } catch {
                  // Parsing failed, keep as string
                  return { ...p, isActive: false }
                }
              }
              return { ...p, isActive: false }
            })
          })
          break

        case 'tool_result': {
          // Insert tool_result right after the assistant message that contains this tool_call_id,
          // so order stays Calling (Shell: N) → Result (Shell: N) even when results arrive out of order.
          const newId = `msg-${Date.now()}`
          const newMsg: Message = {
            id: newId,
            role: 'tool_result',
            content: '',
            tool_call_id: data.tool_call_id,
            output: data.output ?? ''
          }
          const toolCallId = data.tool_call_id
          setMessages((prev) => {
            let insertIndex = prev.length
            for (let i = 0; i < prev.length; i++) {
              const msg = prev[i]
              if (msg.role === 'assistant' && msg.parts) {
                const hasMatch = msg.parts.some(
                  (p) => p.type === 'tool_call' && p.tool_call_id === toolCallId
                )
                if (hasMatch) {
                  insertIndex = i + 1
                  break
                }
              }
            }
            return [
              ...prev.slice(0, insertIndex),
              newMsg,
              ...prev.slice(insertIndex)
            ]
          })
          // Next chunk/think/tool_call belongs to a new assistant turn
          streamingMsgIdRef.current = null
          break
        }

        case 'complete':
        case 'assistant':
          // Finalize: mark streaming as done and convert parts if needed
          setMessages((prev) => {
            const streamingId = streamingMsgIdRef.current
            if (streamingId) {
              const msgIndex = prev.findIndex(m => m.id === streamingId)
              if (msgIndex >= 0) {
                const msg = prev[msgIndex]
                // If backend sent complete tool_calls, use them to update existing parts
                const backendToolCalls = data.tool_calls as Array<{tool_name: string; arguments: Record<string, unknown>}> | undefined
                let partsWithToolCalls = msg.parts || []

                if (backendToolCalls && backendToolCalls.length > 0) {
                  // Update existing tool_call parts with backend data
                  let toolCallIndex = 0
                  partsWithToolCalls = partsWithToolCalls.map(p => {
                    if (p.type === 'tool_call' && toolCallIndex < backendToolCalls.length) {
                      const backendTc = backendToolCalls[toolCallIndex++]
                      return { ...p, tool_name: backendTc.tool_name, arguments: backendTc.arguments, isActive: false }
                    }
                    return { ...p, isActive: false }
                  })
                } else {
                  // No backend tool_calls, just mark inactive and try to parse string args
                  partsWithToolCalls = partsWithToolCalls.map(p => {
                    if (p.type === 'tool_call' && typeof p.arguments === 'string') {
                      try {
                        const parsed = JSON.parse(p.arguments)
                        return { ...p, arguments: parsed, isActive: false }
                      } catch {
                        return { ...p, isActive: false }
                      }
                    }
                    return { ...p, isActive: false }
                  })
                }

                // If backend sent full content, add it as final text part
                let partsWithContent = partsWithToolCalls
                if (data.content) {
                  partsWithContent = [...partsWithToolCalls, { type: 'text', content: data.content }]
                }
                const updated = [...prev]
                updated[msgIndex] = { ...msg, id: `msg-${Date.now()}`, parts: partsWithContent }
                return updated
              }
            }
            // No streaming message, add new assistant message
            if (data.content) {
              return [...prev, { id: `msg-${Date.now()}`, role: 'assistant', content: data.content, parts: [{ type: 'text', content: data.content }] }]
            }
            return prev
          })
          streamingMsgIdRef.current = null
          setIsLoading(false)
          break

        case 'error':
          setMessages((prev) => [...prev, { id: `error-${Date.now()}`, role: 'error', content: data.message }])
          streamingMsgIdRef.current = null
          setIsLoading(false)
          break

        case 'approval_result':
          setMessages((prev) => [
            ...prev,
            { id: `approval-${Date.now()}`, role: 'approval', content: data.approved ? 'Approved' : 'Rejected' }
          ])
          break
      }
    }

    ws.onclose = (event) => {
      setIsConnected(false)
      // Fail fast on abnormal closure after logging
      if (!event.wasClean && event.code !== 1000) {
        console.error(`WebSocket closed unexpectedly: ${event.code} ${event.reason}`)
      }
    }

    ws.onerror = (error) => {
      // Log error details for debugging
      console.error('WebSocket error:', error)
    }

    wsRef.current = ws

    return () => ws.close(1000, 'Component unmounting')
  }, [convId])

  // File upload
  const uploadFile = async (file: File): Promise<UploadedFile | null> => {
    if (!convId) return null
    const formData = new FormData()
    formData.append('file', file)

    try {
      const res = await fetch(`/api/conversations/${convId}/upload`, {
        method: 'POST',
        body: formData
      })
      if (!res.ok) throw new Error(`Upload failed: ${res.statusText}`)
      const data = await res.json()
      return { url: data.url, filename: data.filename }
    } catch (err) {
      console.error('Failed to upload file:', err)
      return null
    }
  }

  // Send message
  const handleSend = async () => {
    if ((!input.trim() && attachments.length === 0) || !wsRef.current || !isConnected) return

    // Add user message immediately
    const userContent = input.trim()
    setMessages((prev) => [...prev, {
      id: `user-${Date.now()}`,
      role: 'user',
      content: userContent
    }])

    setIsLoading(true)
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
      message: userContent,
      thinking: thinkingEnabled,
      model: selectedModel,
      attachments: uploadedAttachments.length > 0 ? uploadedAttachments : undefined
    }))

    setInput('')
    setAttachments([])
    if (textareaRef.current) textareaRef.current.style.height = 'auto'
  }

  // Keyboard handling
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

  // File handling
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

    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const removeAttachment = (id: string) => {
    setAttachments((prev) => {
      const found = prev.find((a) => a.id === id)
      if (found?.url) URL.revokeObjectURL(found.url)
      return prev.filter((a) => a.id !== id)
    })
  }

  const createConversation = async () => {
    try {
      const res = await fetch('/api/conversations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: 'New Conversation' })
      })
      const data = await res.json()
      if (data.conversation) {
        setSearchParams({ id: data.conversation.id })
      }
    } catch (err) {
      console.error('Failed to create conversation:', err)
    }
  }

  // Formatting
  const formatContextUsage = () => {
    const usage = statusInfo.context_usage
    if (usage === null) return '--'
    return `${Math.round(usage * 100)}%`
  }

  // Toggle block expansion
  const toggleBlock = (id: string) => {
    setExpandedBlocks((prev) => {
      const newSet = new Set(prev)
      if (newSet.has(id)) newSet.delete(id)
      else newSet.add(id)
      return newSet
    })
  }

  const selectedModelData = models.find(m => m.id === selectedModel)

  // Render messages
  const renderMessages = () => {
    return messages.map((msg) => {
      switch (msg.role) {
        case 'user':
          return <UserMessage key={msg.id} content={msg.content} />
        case 'assistant':
          return (
            <AssistantMessage
              key={msg.id}
              messageId={msg.id}
              parts={msg.parts}
              isStreaming={isLoading && msg.id === streamingMsgIdRef.current}
              expandedBlocks={expandedBlocks}
              onToggleBlock={toggleBlock}
              thinkingDuration={thinkingDuration}
            />
          )
        case 'error':
          return <ErrorMessage key={msg.id} content={msg.content} />
        case 'approval':
          return <ApprovalMessage key={msg.id} content={msg.content} />
        case 'tool_result':
          return (
            <ToolResultMessage
              key={msg.id}
              messageId={msg.id}
              toolCallId={msg.tool_call_id}
              output={msg.output ?? ''}
              expandedBlocks={expandedBlocks}
              onToggleBlock={toggleBlock}
            />
          )
        default:
          return null
      }
    })
  }

  return (
    <div className="h-full flex flex-col bg-background overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border shrink-0">
        <div className="flex items-center gap-2 min-w-0">
          {convId ? (
            <>
              <Bot className="w-4 h-4 text-primary" />
              <span className="text-sm font-medium truncate">Chat</span>
            </>
          ) : (
            <span className="text-sm text-muted-foreground">No Active Session</span>
          )}
        </div>

        <div className="flex items-center gap-1">
          {convId && (
            <>
              <button className="inline-flex items-center gap-1.5 px-2 py-1.5 text-xs text-muted-foreground hover:text-foreground hover:bg-muted rounded-md transition-colors">
                <span>{formatContextUsage()} context</span>
              </button>

              <div className="w-px h-4 bg-border mx-1" />

              <button
                onClick={() => setExpandAll(!expandAll)}
                className="p-2 text-muted-foreground hover:text-foreground hover:bg-muted rounded-md transition-colors"
                title={expandAll ? 'Collapse all' : 'Expand all'}
              >
                {expandAll ? <ChevronsDownUp className="w-4 h-4" /> : <ChevronsUpDown className="w-4 h-4" />}
              </button>
            </>
          )}
        </div>
      </div>

      {/* Messages */}
      <div ref={messagesContainerRef} className="flex-1 overflow-y-auto">
        {!convId ? (
          <div className="h-full flex flex-col items-center justify-center p-8">
            <div className="w-16 h-16 bg-primary/10 rounded-2xl flex items-center justify-center mb-6">
              <MessageSquare className="w-8 h-8 text-primary" />
            </div>
            <h1 className="text-2xl font-semibold mb-2">Welcome to Legion Chat</h1>
            <p className="text-muted-foreground text-sm mb-8">Start a new conversation or select an existing one</p>
            <button
              onClick={createConversation}
              className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors text-sm font-medium"
            >
              <Plus className="w-4 h-4" />
              <span>New Chat</span>
            </button>
          </div>
        ) : messages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-muted-foreground">
            <Sparkles className="w-8 h-8 mb-4 opacity-50" />
            <p className="text-sm">How can I help you today?</p>
          </div>
        ) : (
          <div className="px-4 sm:px-6 lg:px-8 py-6 space-y-4">
            {renderMessages()}
            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      {/* Input Area */}
      <div className="px-4 sm:px-6 lg:px-8 py-4 shrink-0 bg-background">
        <div className="max-w-none">
          {/* Attachments */}
          {attachments.length > 0 && (
            <div className="flex flex-wrap gap-2 mb-3">
              {attachments.map((file) => (
                <AttachmentPreview
                  key={file.id}
                  attachment={file}
                  onRemove={() => removeAttachment(file.id)}
                />
              ))}
            </div>
          )}

          {/* Input container */}
          <div className="relative rounded-xl border border-border bg-muted/30 focus-within:bg-background focus-within:border-primary transition-colors">
            <textarea
              ref={textareaRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={!convId ? 'Create a session to start...' : !isConnected ? 'Connecting...' : 'Message...'}
              disabled={!convId || isLoading || !isConnected}
              rows={1}
              className="w-full bg-transparent border-0 px-4 py-3 text-sm resize-none focus:outline-none focus:ring-0 disabled:opacity-50 min-h-[52px] max-h-[200px]"
            />

            {/* Toolbar */}
            <div className="flex items-center justify-between px-2 pb-2">
              <div className="flex items-center gap-0.5">
                {/* File upload */}
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
                  className="p-2 text-muted-foreground hover:text-foreground hover:bg-muted rounded-lg transition-colors disabled:opacity-50"
                  title="Attach files"
                >
                  <Paperclip className="w-4 h-4" />
                </button>

                <div className="w-px h-4 bg-border mx-1" />

                {/* Model selector button */}
                <button
                  onClick={() => setShowModelSelector(true)}
                  disabled={!convId || isLoading || !configLoaded}
                  className="flex items-center gap-2 px-2 py-1.5 text-xs text-muted-foreground hover:text-foreground hover:bg-muted rounded-lg transition-colors disabled:opacity-50"
                >
                  <Cpu className="w-3.5 h-3.5" />
                  <span className="max-w-[120px] truncate">{selectedModelData?.name || selectedModel || 'Select model'}</span>
                </button>

                {/* Thinking toggle */}
                <button
                  onClick={() => setThinkingEnabled(!thinkingEnabled)}
                  disabled={!convId || isLoading}
                  className={clsx(
                    'flex items-center gap-1.5 px-2 py-1.5 text-xs rounded-lg transition-colors disabled:opacity-50',
                    thinkingEnabled
                      ? 'text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/30'
                      : 'text-muted-foreground hover:text-foreground hover:bg-muted'
                  )}
                >
                  <Brain className="w-3.5 h-3.5" />
                  <span>Thinking</span>
                </button>
              </div>

              {/* Right side */}
              <div className="flex items-center gap-2">
                <span className="hidden sm:inline text-xs text-muted-foreground">
                  {formatContextUsage()} context
                </span>

                {isLoading ? (
                  <button
                    onClick={() => {}}
                    className="p-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors"
                  >
                    <Square className="w-4 h-4 fill-current" />
                  </button>
                ) : (
                  <button
                    onClick={handleSend}
                    disabled={!convId || (!input.trim() && attachments.length === 0)}
                    className="p-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-50"
                  >
                    <CornerDownLeft className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Model Selector Modal */}
      <ModelSelectorModal
        isOpen={showModelSelector}
        onClose={() => setShowModelSelector(false)}
        models={models}
        selectedModel={selectedModel}
        onSelect={setSelectedModel}
      />
    </div>
  )
}
