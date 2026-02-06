import { useEffect, useState } from 'react'


interface StatusData {
  status: string
  version: string
  timestamp: number
}

export default function Overview() {
  const [, setStatus] = useState<StatusData | null>(null)
  const [wsStatus, setWsStatus] = useState<'connected' | 'disconnected'>('disconnected')

  useEffect(() => {
    // Fetch initial status
    fetch('/api/status')
      .then((res) => res.json())
      .then((data) => setStatus(data))
      .catch(() => setStatus({ status: 'error', version: 'unknown', timestamp: 0 }))

    // WebSocket connection
    const ws = new WebSocket(`ws://${window.location.host}/ws`)

    ws.onopen = () => setWsStatus('connected')
    ws.onclose = () => setWsStatus('disconnected')
    ws.onerror = () => setWsStatus('disconnected')

    return () => ws.close()
  }, [])

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-semibold">Overview</h1>
        <p className="text-oc-text-muted mt-1">
          Gateway status, entry points, and a fast health read.
        </p>
      </div>

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Gateway Access Card */}
        <div className="bg-oc-surface rounded-xl border border-oc-border p-6">
          <h2 className="text-lg font-medium mb-1">Gateway Access</h2>
          <p className="text-sm text-oc-text-muted mb-4">
            Where the dashboard connects and how it authenticates.
          </p>

          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-xs text-oc-text-muted uppercase tracking-wider">
                  WebSocket URL
                </label>
                <div className="mt-1 px-3 py-2 bg-oc-bg rounded-lg border border-oc-border text-sm font-mono">
                  ws://127.0.0.1:18790
                </div>
              </div>
              <div>
                <label className="text-xs text-oc-text-muted uppercase tracking-wider">
                  Gateway Token
                </label>
                <div className="mt-1 px-3 py-2 bg-oc-bg rounded-lg border border-oc-border text-sm font-mono truncate">
                  6c3229d25f6f744110972b97bc7ba9ac
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-xs text-oc-text-muted uppercase tracking-wider">
                  Password (not stored)
                </label>
                <div className="mt-1 px-3 py-2 bg-oc-bg rounded-lg border border-oc-border text-sm text-oc-text-muted">
                  system or shared password
                </div>
              </div>
              <div>
                <label className="text-xs text-oc-text-muted uppercase tracking-wider">
                  Default Session Key
                </label>
                <div className="mt-1 px-3 py-2 bg-oc-bg rounded-lg border border-oc-border text-sm font-mono">
                  agent:main:main
                </div>
              </div>
            </div>

            <div className="flex items-center gap-3 pt-2">
              <button className="px-4 py-2 bg-oc-surface-hover hover:bg-oc-border rounded-lg text-sm font-medium transition-colors">
                Connect
              </button>
              <button className="px-4 py-2 bg-oc-surface-hover hover:bg-oc-border rounded-lg text-sm font-medium transition-colors">
                Refresh
              </button>
              <span className="text-sm text-oc-text-muted">
                Click Connect to apply connection changes.
              </span>
            </div>
          </div>
        </div>

        {/* Snapshot Card */}
        <div className="bg-oc-surface rounded-xl border border-oc-border p-6">
          <h2 className="text-lg font-medium mb-1">Snapshot</h2>
          <p className="text-sm text-oc-text-muted mb-4">
            Latest gateway handshake information.
          </p>

          <div className="grid grid-cols-3 gap-4 mb-4">
            <div className="bg-oc-bg rounded-lg p-4 border border-oc-border">
              <div className="text-xs text-oc-text-muted uppercase tracking-wider mb-2">
                Status
              </div>
              <div className={`text-lg font-semibold ${wsStatus === 'connected' ? 'text-green-500' : 'text-red-500'}`}>
                {wsStatus === 'connected' ? 'Connected' : 'Disconnected'}
              </div>
            </div>
            <div className="bg-oc-bg rounded-lg p-4 border border-oc-border">
              <div className="text-xs text-oc-text-muted uppercase tracking-wider mb-2">
                Uptime
              </div>
              <div className="text-lg font-semibold">29h</div>
            </div>
            <div className="bg-oc-bg rounded-lg p-4 border border-oc-border">
              <div className="text-xs text-oc-text-muted uppercase tracking-wider mb-2">
                Tick Interval
              </div>
              <div className="text-lg font-semibold">n/a</div>
            </div>
          </div>

          <div className="bg-oc-bg rounded-lg p-4 border border-oc-border mb-4">
            <div className="text-xs text-oc-text-muted uppercase tracking-wider mb-2">
              Last Channels Refresh
            </div>
            <div className="text-xl font-semibold">3s ago</div>
          </div>

          <div className="bg-oc-bg rounded-lg p-3 border border-oc-border text-sm text-oc-text-muted">
            Use Channels to link WhatsApp, Telegram, Discord, Signal, or iMessage.
          </div>
        </div>
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-oc-surface rounded-xl border border-oc-border p-6">
          <div className="text-xs text-oc-text-muted uppercase tracking-wider mb-2">
            Instances
          </div>
          <div className="text-3xl font-semibold mb-1">2</div>
          <p className="text-sm text-oc-text-muted">
            Presence beacons in the last 5 minutes.
          </p>
        </div>

        <div className="bg-oc-surface rounded-xl border border-oc-border p-6">
          <div className="text-xs text-oc-text-muted uppercase tracking-wider mb-2">
            Sessions
          </div>
          <div className="text-3xl font-semibold mb-1">2</div>
          <p className="text-sm text-oc-text-muted">
            Recent session keys tracked by the gateway.
          </p>
        </div>

        <div className="bg-oc-surface rounded-xl border border-oc-border p-6">
          <div className="text-xs text-oc-text-muted uppercase tracking-wider mb-2">
            Cron
          </div>
          <div className="text-2xl font-semibold mb-1">Enabled</div>
          <p className="text-sm text-oc-text-muted">
            Next wake n/a
          </p>
        </div>
      </div>

      {/* Notes Section */}
      <div className="bg-oc-surface rounded-xl border border-oc-border p-6">
        <h2 className="text-lg font-medium mb-1">Notes</h2>
        <p className="text-sm text-oc-text-muted mb-4">
          Quick reminders for remote control setups.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div>
            <h3 className="text-sm font-medium mb-2">Tailscale serve</h3>
            <p className="text-sm text-oc-text-muted">
              Prefer serve mode to keep the gateway on loopback with tailnet auth.
            </p>
          </div>
          <div>
            <h3 className="text-sm font-medium mb-2">Session hygiene</h3>
            <p className="text-sm text-oc-text-muted">
              Use /new or sessions.patch to reset context.
            </p>
          </div>
          <div>
            <h3 className="text-sm font-medium mb-2">Cron reminders</h3>
            <p className="text-sm text-oc-text-muted">
              Use isolated sessions for recurring runs.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
