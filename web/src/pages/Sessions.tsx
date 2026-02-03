import { Layers, Trash2, RefreshCw } from 'lucide-react'

export default function Sessions() {
  const sessions = [
    { key: 'agent:main:main', created: '2024-01-15 10:30', lastUsed: '2 mins ago', messages: 156 },
    { key: 'agent:worker:1', created: '2024-01-15 08:00', lastUsed: '1 hour ago', messages: 42 },
  ]

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Sessions</h1>
        <p className="text-oc-text-muted mt-1">
          Manage active conversation sessions.
        </p>
      </div>

      <div className="bg-oc-surface rounded-xl border border-oc-border overflow-hidden">
        <table className="w-full">
          <thead className="bg-oc-bg border-b border-oc-border">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium text-oc-text-muted uppercase">Session Key</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-oc-text-muted uppercase">Created</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-oc-text-muted uppercase">Last Used</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-oc-text-muted uppercase">Messages</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-oc-text-muted uppercase">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-oc-border">
            {sessions.map((session) => (
              <tr key={session.key} className="hover:bg-oc-bg/50">
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <Layers size={16} className="text-oc-text-muted" />
                    <span className="font-mono text-sm">{session.key}</span>
                  </div>
                </td>
                <td className="px-4 py-3 text-oc-text-muted text-sm">{session.created}</td>
                <td className="px-4 py-3 text-oc-text-muted text-sm">{session.lastUsed}</td>
                <td className="px-4 py-3 text-oc-text-muted text-sm">{session.messages}</td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-1">
                    <button className="p-1.5 hover:bg-oc-bg rounded transition-colors" title="Reset">
                      <RefreshCw size={16} />
                    </button>
                    <button className="p-1.5 hover:bg-oc-bg rounded transition-colors text-red-500" title="Delete">
                      <Trash2 size={16} />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
