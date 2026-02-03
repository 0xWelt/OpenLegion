import { FileText, Download, Trash2 } from 'lucide-react'

export default function Logs() {
  const logs = [
    { time: '2024-01-15 10:30:45', level: 'INFO', message: 'Gateway started successfully' },
    { time: '2024-01-15 10:30:46', level: 'INFO', message: 'WebSocket server listening on ws://127.0.0.1:18789' },
    { time: '2024-01-15 10:31:02', level: 'DEBUG', message: 'New connection established: client_1' },
    { time: '2024-01-15 10:35:12', level: 'INFO', message: 'Session created: agent:main:main' },
    { time: '2024-01-15 10:45:33', level: 'WARN', message: 'High memory usage detected: 78%' },
  ]

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Logs</h1>
          <p className="text-oc-text-muted mt-1">
            View system logs and diagnostics.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button className="flex items-center gap-2 px-3 py-1.5 bg-oc-surface-hover rounded-lg text-sm hover:bg-oc-border transition-colors">
            <Download size={16} />
            Export
          </button>
          <button className="flex items-center gap-2 px-3 py-1.5 bg-oc-surface-hover rounded-lg text-sm hover:bg-oc-border transition-colors text-red-500">
            <Trash2 size={16} />
            Clear
          </button>
        </div>
      </div>

      <div className="bg-oc-surface rounded-xl border border-oc-border overflow-hidden">
        <div className="max-h-96 overflow-y-auto scrollbar-thin">
          <table className="w-full">
            <thead className="bg-oc-bg border-b border-oc-border sticky top-0">
              <tr>
                <th className="px-4 py-2 text-left text-xs font-medium text-oc-text-muted uppercase w-40">Time</th>
                <th className="px-4 py-2 text-left text-xs font-medium text-oc-text-muted uppercase w-20">Level</th>
                <th className="px-4 py-2 text-left text-xs font-medium text-oc-text-muted uppercase">Message</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-oc-border font-mono text-sm">
              {logs.map((log, idx) => (
                <tr key={idx} className="hover:bg-oc-bg/50">
                  <td className="px-4 py-2 text-oc-text-muted">{log.time}</td>
                  <td className="px-4 py-2">
                    <span
                      className={`px-2 py-0.5 rounded text-xs ${
                        log.level === 'ERROR'
                          ? 'bg-red-500/20 text-red-500'
                          : log.level === 'WARN'
                          ? 'bg-yellow-500/20 text-yellow-500'
                          : log.level === 'DEBUG'
                          ? 'bg-blue-500/20 text-blue-500'
                          : 'bg-green-500/20 text-green-500'
                      }`}
                    >
                      {log.level}
                    </span>
                  </td>
                  <td className="px-4 py-2">{log.message}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
