import { Monitor, Activity, Power } from 'lucide-react'

export default function Instances() {
  const instances = [
    { id: 1, name: 'Main Agent', status: 'running', uptime: '29h', cpu: '12%', memory: '256MB' },
    { id: 2, name: 'Worker 1', status: 'idle', uptime: '5h', cpu: '0%', memory: '128MB' },
  ]

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Instances</h1>
        <p className="text-oc-text-muted mt-1">
          Manage running agent instances.
        </p>
      </div>

      <div className="bg-oc-surface rounded-xl border border-oc-border overflow-hidden">
        <table className="w-full">
          <thead className="bg-oc-bg border-b border-oc-border">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium text-oc-text-muted uppercase">Name</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-oc-text-muted uppercase">Status</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-oc-text-muted uppercase">Uptime</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-oc-text-muted uppercase">CPU</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-oc-text-muted uppercase">Memory</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-oc-text-muted uppercase">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-oc-border">
            {instances.map((instance) => (
              <tr key={instance.id} className="hover:bg-oc-bg/50">
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <Monitor size={16} className="text-oc-text-muted" />
                    <span className="font-medium">{instance.name}</span>
                  </div>
                </td>
                <td className="px-4 py-3">
                  <span
                    className={`inline-flex items-center gap-1 px-2 py-1 rounded text-xs ${
                      instance.status === 'running'
                        ? 'bg-green-500/20 text-green-500'
                        : 'bg-yellow-500/20 text-yellow-500'
                    }`}
                  >
                    <Activity size={12} />
                    {instance.status}
                  </span>
                </td>
                <td className="px-4 py-3 text-oc-text-muted">{instance.uptime}</td>
                <td className="px-4 py-3 text-oc-text-muted">{instance.cpu}</td>
                <td className="px-4 py-3 text-oc-text-muted">{instance.memory}</td>
                <td className="px-4 py-3">
                  <button className="p-1.5 hover:bg-oc-bg rounded transition-colors">
                    <Power size={16} className="text-red-500" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
