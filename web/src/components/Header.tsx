import { Menu, Bell } from 'lucide-react'

interface HeaderProps {
  sidebarOpen: boolean
  onToggleSidebar: () => void
}

export default function Header({ sidebarOpen, onToggleSidebar }: HeaderProps) {
  return (
    <header className="h-14 bg-oc-surface border-b border-oc-border flex items-center justify-between px-4">
      {/* Left side */}
      <div className="flex items-center gap-4">
        <button
          onClick={onToggleSidebar}
          className="w-8 h-8 flex items-center justify-center rounded-lg text-oc-text-muted hover:text-oc-text hover:bg-oc-surface-hover lg:hidden"
          title={sidebarOpen ? 'Collapse sidebar' : 'Expand sidebar'}
        >
          <Menu size={18} />
        </button>
      </div>

      {/* Right side */}
      <div className="flex items-center gap-2">
        {/* Health Status */}
        <div className="flex items-center gap-2 px-3 py-1.5 bg-oc-bg rounded-lg border border-oc-border">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-oc-primary opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-oc-primary"></span>
          </span>
          <span className="text-xs text-oc-text-muted">Health</span>
          <span className="text-xs font-medium">OK</span>
        </div>

        {/* Notifications */}
        <button className="relative w-8 h-8 flex items-center justify-center rounded-lg text-oc-text-muted hover:text-oc-text hover:bg-oc-surface-hover">
          <Bell size={18} />
          <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 rounded-full"></span>
        </button>
      </div>
    </header>
  )
}
