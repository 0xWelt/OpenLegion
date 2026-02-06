import { Outlet, useLocation } from 'react-router-dom'
import { useState } from 'react'
import Sidebar from './Sidebar'
import Header from './Header'

export default function Layout() {
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const location = useLocation()
  const isChatPage = location.pathname.startsWith('/chat')

  return (
    <div className="flex h-screen bg-oc-bg text-oc-text overflow-hidden">
      {/* Sidebar - fixed width container */}
      <div className={sidebarOpen ? 'w-56' : 'w-14'}>
        <Sidebar open={sidebarOpen} onToggle={() => setSidebarOpen(!sidebarOpen)} />
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0">
        <Header
          sidebarOpen={sidebarOpen}
          onToggleSidebar={() => setSidebarOpen(!sidebarOpen)}
        />
        <main className={`flex-1 min-w-0 overflow-hidden ${isChatPage ? '' : 'p-6'}`}>
          <Outlet />
        </main>
      </div>
    </div>
  )
}
