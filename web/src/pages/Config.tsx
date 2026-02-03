import { Settings, Save } from 'lucide-react'

export default function Config() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Config</h1>
        <p className="text-oc-text-muted mt-1">
          Manage Legion configuration settings.
        </p>
      </div>

      <div className="bg-oc-surface rounded-xl border border-oc-border p-6 space-y-6">
        <div className="flex items-center gap-3 pb-4 border-b border-oc-border">
          <Settings size={20} className="text-oc-text-muted" />
          <h2 className="text-lg font-medium">General Settings</h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-medium mb-2">Gateway Host</label>
            <input
              type="text"
              defaultValue="127.0.0.1"
              className="w-full bg-oc-bg border border-oc-border rounded-lg px-4 py-2 text-sm focus:outline-none focus:border-oc-primary"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-2">Gateway Port</label>
            <input
              type="number"
              defaultValue={18789}
              className="w-full bg-oc-bg border border-oc-border rounded-lg px-4 py-2 text-sm focus:outline-none focus:border-oc-primary"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-2">Log Level</label>
            <select className="w-full bg-oc-bg border border-oc-border rounded-lg px-4 py-2 text-sm focus:outline-none focus:border-oc-primary">
              <option>debug</option>
              <option>info</option>
              <option>warn</option>
              <option>error</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium mb-2">Max Sessions</label>
            <input
              type="number"
              defaultValue={10}
              className="w-full bg-oc-bg border border-oc-border rounded-lg px-4 py-2 text-sm focus:outline-none focus:border-oc-primary"
            />
          </div>
        </div>

        <div className="flex justify-end pt-4 border-t border-oc-border">
          <button className="flex items-center gap-2 px-4 py-2 bg-oc-primary text-white rounded-lg hover:bg-oc-primary-hover transition-colors">
            <Save size={18} />
            <span className="text-sm font-medium">Save Changes</span>
          </button>
        </div>
      </div>
    </div>
  )
}
