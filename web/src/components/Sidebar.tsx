import { NavLink } from 'react-router-dom'
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
  PanelLeftOpen,
  PanelLeftClose,
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

            return (
              <div key={category} className="mb-4">
                <div className="px-4 py-2 text-xs font-medium text-oc-text-muted uppercase tracking-wider">
                  {category}
                </div>
                {items.map((item) => (
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
                    {category === 'Chat' && (
                      <ChevronRight size={14} className="opacity-50" />
                    )}
                  </NavLink>
                ))}
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
