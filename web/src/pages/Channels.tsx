import { Radio, Plus, Settings } from 'lucide-react'

export default function Channels() {
  const channels = [
    { name: 'WhatsApp', status: 'disconnected', icon: '💬' },
    { name: 'Telegram', status: 'connected', icon: '📱' },
    { name: 'Discord', status: 'disconnected', icon: '🎮' },
    { name: 'Signal', status: 'disconnected', icon: '🔒' },
  ]

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Channels</h1>
          <p className="text-oc-text-muted mt-1">
            Manage your messaging platform connections.
          </p>
        </div>
        <button className="flex items-center gap-2 px-4 py-2 bg-oc-primary text-white rounded-lg hover:bg-oc-primary-hover transition-colors">
          <Plus size={18} />
          <span className="text-sm font-medium">Add Channel</span>
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {channels.map((channel) => (
          <div
            key={channel.name}
            className="bg-oc-surface rounded-xl border border-oc-border p-4"
          >
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-3">
                <span className="text-2xl">{channel.icon}</span>
                <span className="font-medium">{channel.name}</span>
              </div>
              <span
                className={`px-2 py-0.5 rounded text-xs ${
                  channel.status === 'connected'
                    ? 'bg-green-500/20 text-green-500'
                    : 'bg-gray-500/20 text-gray-400'
                }`}
              >
                {channel.status}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <button className="flex-1 px-3 py-1.5 bg-oc-bg rounded-lg text-sm hover:bg-oc-surface-hover transition-colors">
                Configure
              </button>
              <button className="p-1.5 bg-oc-bg rounded-lg hover:bg-oc-surface-hover transition-colors">
                <Settings size={16} />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
