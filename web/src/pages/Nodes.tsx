import { Layers, Plus, Circle } from 'lucide-react'

export default function Nodes() {
  const nodes = [
    { id: 1, name: 'Gateway Node', type: 'gateway', status: 'online', load: '12%' },
    { id: 2, name: 'Worker Node 1', type: 'worker', status: 'online', load: '8%' },
    { id: 3, name: 'Worker Node 2', type: 'worker', status: 'offline', load: '-' },
  ]

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Nodes</h1>
          <p className="text-oc-text-muted mt-1">
            Manage distributed agent nodes.
          </p>
        </div>
        <button className="flex items-center gap-2 px-4 py-2 bg-oc-primary text-white rounded-lg hover:bg-oc-primary-hover transition-colors">
          <Plus size={18} />
          <span className="text-sm font-medium">Add Node</span>
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 max-w-7xl">
        {nodes.map((node) => (
          <div
            key={node.id}
            className="bg-oc-surface rounded-xl border border-oc-border p-4"
          >
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-oc-bg flex items-center justify-center">
                  <Layers size={20} className="text-oc-text-muted" />
                </div>
                <div>
                  <h3 className="font-medium">{node.name}</h3>
                  <span className="text-xs text-oc-text-muted uppercase">{node.type}</span>
                </div>
              </div>
              <Circle
                size={12}
                className={node.status === 'online' ? 'text-green-500 fill-green-500' : 'text-gray-500'}
              />
            </div>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-oc-text-muted">Status</span>
                <p className="font-medium">{node.status}</p>
              </div>
              <div>
                <span className="text-oc-text-muted">Load</span>
                <p className="font-medium">{node.load}</p>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
