import { useState, useEffect, useCallback } from 'react'
import { NavLink, useLocation, useSearchParams, useNavigate } from 'react-router-dom'
import clsx from 'clsx'
import {
  MessageSquare,
  BarChart3,
  Radio,
  Monitor,
  CalendarClock,
  Zap,
  Layers,
  Settings,
  FileText,
  ChevronRight,
  ChevronDown,
  PanelLeftOpen,
  PanelLeftClose,
  Plus,
  Trash2,
  Edit2,
  Check,
  X,
  History
} from 'lucide-react'
import { ThemeToggle } from './ui/ThemeToggle'

interface SidebarProps {
  open: boolean
  onToggle: () => void
}

interface NavItem {
  label: string
  path: string
  icon: React.ElementType
  category?: string
}

interface Conversation {
  id: string
  title: string
  session_id: string
  work_dir: string
  created_at: string
  updated_at: string
  message_count: number
}

const navItems: NavItem[] = [
  { label: 'Chat', path: '/chat', icon: MessageSquare, category: 'Chat' },
  { label: 'Overview', path: '/', icon: BarChart3, category: 'Control' },
  { label: 'Channels', path: '/channels', icon: Radio, category: 'Control' },
  { label: 'Instances', path: '/instances', icon: Monitor, category: 'Control' },
  { label: 'Sessions', path: '/sessions', icon: Layers, category: 'Control' },
  { label: 'Cron Jobs', path: '/cron', icon: CalendarClock, category: 'Control' },
  { label: 'Skills', path: '/skills', icon: Zap, category: 'Agent' },
  { label: 'Nodes', path: '/nodes', icon: Layers, category: 'Agent' },
  { label: 'Config', path: '/config', icon: Settings, category: 'Settings' },
  { label: 'Logs', path: '/logs', icon: FileText, category: 'Settings' },
]

const categories = ['Chat', 'Control', 'Agent', 'Settings']

export default function Sidebar({ open, onToggle }: SidebarProps) {
  const location = useLocation()
  const [searchParams, setSearchParams] = useSearchParams()
  const navigate = useNavigate()

  // Conversations state
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editTitle, setEditTitle] = useState('')

  // Category expansion state - default all expanded, independent control
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set(categories))

  const convId = searchParams.get('id')
  const isChatPage = location.pathname === '/chat'

  // Fetch conversations
  const fetchConversations = useCallback(async () => {
    try {
      const res = await fetch('/api/conversations')
      const data = await res.json()
      if (data.conversations) {
        setConversations(data.conversations)
      }
    } catch (err) {
      console.error('Failed to fetch conversations:', err)
    }
  }, [])

  // Load conversations on mount and when on chat page
  useEffect(() => {
    if (isChatPage) {
      fetchConversations()
    }
  }, [isChatPage, fetchConversations])

  // Refresh conversations periodically when on chat page
  useEffect(() => {
    if (!isChatPage) return

    const interval = setInterval(fetchConversations, 5000)
    return () => clearInterval(interval)
  }, [isChatPage, fetchConversations])

  // Create new conversation
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
        // Navigate to chat page with new conversation
        if (!isChatPage) {
          navigate(`/chat?id=${data.conversation.id}`)
        } else {
          setSearchParams({ id: data.conversation.id })
        }
      }
    } catch (err) {
      console.error('Failed to create conversation:', err)
    }
  }

  // Select conversation
  const selectConversation = (id: string) => {
    if (!isChatPage) {
      navigate(`/chat?id=${id}`)
    } else {
      setSearchParams({ id })
    }
  }

  // Delete conversation
  const deleteConversation = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation()
    if (!confirm('Are you sure you want to delete this conversation?')) return

    try {
      await fetch(`/api/conversations/${id}`, { method: 'DELETE' })
      setConversations((prev) => prev.filter((c) => c.id !== id))
      if (convId === id) {
        setSearchParams({})
      }
    } catch (err) {
      console.error('Failed to delete conversation:', err)
    }
  }

  // Start editing title
  const startEditTitle = (conv: Conversation, e: React.MouseEvent) => {
    e.stopPropagation()
    setEditingId(conv.id)
    setEditTitle(conv.title)
  }

  // Save title
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

  // Cancel editing
  const cancelEdit = () => {
    setEditingId(null)
    setEditTitle('')
  }

  // Toggle category expansion
  const toggleCategory = (category: string) => {
    setExpandedCategories((prev) => {
      const newSet = new Set(prev)
      if (newSet.has(category)) {
        newSet.delete(category)
      } else {
        newSet.add(category)
      }
      return newSet
    })
  }

  // Format time
  const formatTime = (isoString: string) => {
    const date = new Date(isoString)
    const now = new Date()
    const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24))

    if (diffDays === 0) {
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    } else if (diffDays === 1) {
      return 'Yesterday'
    } else if (diffDays < 7) {
      return date.toLocaleDateString([], { weekday: 'short' })
    } else {
      return date.toLocaleDateString([], { month: 'short', day: 'numeric' })
    }
  }

  return (
    <aside className="relative h-full bg-oc-surface border-r border-oc-border flex flex-col overflow-hidden">
      {/* Collapsed sidebar - icon only */}
      <div
        className={clsx(
          'absolute inset-0 flex h-full flex-col items-center py-4',
          'transition-all duration-200 ease-in-out',
          open
            ? 'opacity-0 -translate-x-2 pointer-events-none select-none'
            : 'opacity-100 translate-x-0'
        )}
      >
        <div className="mb-6">
          <div className="w-8 h-8 bg-oc-primary rounded-lg flex items-center justify-center">
            <span className="text-white font-bold text-sm">L</span>
          </div>
        </div>
        <nav className="flex-1 flex flex-col gap-1">
          {navItems.slice(0, 6).map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              className={({ isActive }) =>
                clsx(
                  'w-10 h-10 flex items-center justify-center rounded-lg',
                  isActive
                    ? 'bg-oc-surface-hover text-oc-text'
                    : 'text-oc-text-muted hover:text-oc-text hover:bg-oc-surface-hover'
                )
              }
              title={item.label}
            >
              <item.icon size={18} />
            </NavLink>
          ))}
        </nav>
        <button
          type="button"
          aria-label="Expand sidebar"
          className="mt-auto mb-2 inline-flex h-8 w-8 items-center justify-center rounded-lg text-oc-text-muted hover:bg-oc-surface-hover hover:text-oc-text"
          onClick={onToggle}
        >
          <PanelLeftOpen className="w-4 h-4" />
        </button>
      </div>

      {/* Expanded sidebar - full */}
      <div
        className={clsx(
          'absolute inset-0 flex h-full flex-col',
          'transition-all duration-200 ease-in-out',
          open
            ? 'opacity-100 translate-x-0'
            : 'opacity-0 translate-x-2 pointer-events-none select-none'
        )}
      >
        {/* Logo */}
        <div className="h-14 flex items-center px-4 border-b border-oc-border shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-oc-primary rounded-lg flex items-center justify-center">
              <span className="text-white font-bold text-sm">L</span>
            </div>
            <div>
              <h1 className="font-semibold text-sm">LEGION</h1>
              <p className="text-xs text-oc-text-muted">Gateway Dashboard</p>
            </div>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto scrollbar-thin py-2 min-h-0">
          {categories.map((category) => {
            const items = navItems.filter((item) => item.category === category)
            if (items.length === 0) return null

            const isChatCategory = category === 'Chat'
            const isExpanded = expandedCategories.has(category)

            return (
              <div key={category} className="mb-4">
                {/* Category Header - Clickable */}
                <button
                  onClick={() => toggleCategory(category)}
                  className="w-full flex items-center justify-between px-4 py-2 text-xs font-medium text-oc-text-muted uppercase tracking-wider hover:text-oc-text transition-colors"
                >
                  <span>{category}</span>
                  {isChatCategory ? (
                    <ChevronRight size={14} className="opacity-50" />
                  ) : isExpanded ? (
                    <ChevronDown size={14} className="opacity-50" />
                  ) : (
                    <ChevronRight size={14} className="opacity-50" />
                  )}
                </button>

                {/* Category Items */}
                {isExpanded && (
                  <>
                    {/* For Chat category, show conversations directly without 'Chat' nav item */}
                    {isChatCategory ? (
                      <div className="space-y-0.5">
                        {/* New Chat Button */}
                        <button
                          onClick={createConversation}
                          className="w-full flex items-center gap-2 px-4 py-2 mx-2 rounded-lg text-sm text-oc-text-muted hover:text-oc-text hover:bg-oc-surface-hover transition-colors"
                        >
                          <Plus size={14} />
                          <span>New Chat</span>
                        </button>

                        {/* Conversation Items */}
                        {conversations.length === 0 ? (
                          <div className="px-4 py-2 mx-2 text-xs text-oc-text-muted/60">
                            No conversations
                          </div>
                        ) : (
                          conversations.map((conv) => (
                            <div
                              key={conv.id}
                              onClick={() => selectConversation(conv.id)}
                              className={clsx(
                                'group flex items-center gap-2 px-4 py-2 mx-2 rounded-lg cursor-pointer transition-colors text-sm',
                                convId === conv.id
                                  ? 'bg-oc-surface-hover text-oc-text'
                                  : 'text-oc-text-muted hover:text-oc-text hover:bg-oc-surface-hover'
                              )}
                            >
                              <History size={14} className="opacity-60 shrink-0" />

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
                                      className="flex-1 min-w-0 px-1 py-0.5 text-xs bg-oc-bg border border-oc-primary rounded"
                                      autoFocus
                                    />
                                    <button
                                      onClick={(e) => { e.stopPropagation(); saveTitle(conv.id) }}
                                      className="p-0.5 text-oc-primary hover:bg-oc-surface-hover rounded"
                                    >
                                      <Check size={10} />
                                    </button>
                                    <button
                                      onClick={(e) => { e.stopPropagation(); cancelEdit() }}
                                      className="p-0.5 text-oc-text-muted hover:bg-oc-surface-hover rounded"
                                    >
                                      <X size={10} />
                                    </button>
                                  </div>
                                ) : (
                                  <div className="flex items-center justify-between min-w-0">
                                    <span className="truncate">{conv.title}</span>
                                    <span className="text-[10px] text-oc-text-muted/60 shrink-0 ml-1">
                                      {formatTime(conv.updated_at)}
                                    </span>
                                  </div>
                                )}
                              </div>

                              {editingId !== conv.id && (
                                <div className="hidden group-hover:flex items-center gap-0.5 shrink-0">
                                  <button
                                    onClick={(e) => startEditTitle(conv, e)}
                                    className="p-0.5 text-oc-text-muted hover:text-oc-text hover:bg-oc-surface-hover rounded"
                                  >
                                    <Edit2 size={10} />
                                  </button>
                                  <button
                                    onClick={(e) => deleteConversation(conv.id, e)}
                                    className="p-0.5 text-oc-text-muted hover:text-red-500 hover:bg-red-500/10 rounded"
                                  >
                                    <Trash2 size={10} />
                                  </button>
                                </div>
                              )}
                            </div>
                          ))
                        )}
                      </div>
                    ) : (
                      /* For other categories, show nav items normally */
                      items.map((item) => (
                        <NavLink
                          key={item.path}
                          to={item.path}
                          className={({ isActive }) =>
                            clsx(
                              'flex items-center gap-3 px-4 py-2 mx-2 rounded-lg text-sm',
                              isActive
                                ? 'bg-oc-surface-hover text-oc-text'
                                : 'text-oc-text-muted hover:text-oc-text hover:bg-oc-surface-hover'
                            )
                          }
                        >
                          <item.icon size={16} />
                          <span className="flex-1">{item.label}</span>
                        </NavLink>
                      ))
                    )}
                  </>
                )}
              </div>
            )
          })}
        </nav>

        {/* Bottom controls with ThemeToggle */}
        <div className="mt-auto flex items-center justify-between pl-2 pb-2 pr-2 border-t border-oc-border shrink-0">
          <div className="flex items-center gap-2">
            <ThemeToggle />
          </div>
          <button
            type="button"
            aria-label="Collapse sidebar"
            className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-oc-text-muted hover:bg-oc-surface-hover hover:text-oc-text"
            onClick={onToggle}
          >
            <PanelLeftClose className="w-4 h-4" />
          </button>
        </div>
      </div>
    </aside>
  )
}
