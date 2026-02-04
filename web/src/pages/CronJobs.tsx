import { CalendarClock, Plus, Play, Pause, Trash2 } from 'lucide-react'

export default function CronJobs() {
  const jobs = [
    { id: 1, name: 'Daily Backup', schedule: '0 2 * * *', status: 'active', lastRun: '2 hours ago' },
    { id: 2, name: 'Health Check', schedule: '*/5 * * * *', status: 'active', lastRun: '3 mins ago' },
    { id: 3, name: 'Weekly Report', schedule: '0 9 * * 1', status: 'paused', lastRun: '5 days ago' },
  ]

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Cron Jobs</h1>
          <p className="text-oc-text-muted mt-1">
            Manage scheduled recurring tasks.
          </p>
        </div>
        <button className="flex items-center gap-2 px-4 py-2 bg-oc-primary text-white rounded-lg hover:bg-oc-primary-hover transition-colors">
          <Plus size={18} />
          <span className="text-sm font-medium">Add Job</span>
        </button>
      </div>

      <div className="bg-oc-surface rounded-xl border border-oc-border overflow-hidden">
        <table className="w-full">
          <thead className="bg-oc-bg border-b border-oc-border">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium text-oc-text-muted uppercase">Name</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-oc-text-muted uppercase">Schedule</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-oc-text-muted uppercase">Status</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-oc-text-muted uppercase">Last Run</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-oc-text-muted uppercase">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-oc-border">
            {jobs.map((job) => (
              <tr key={job.id} className="hover:bg-oc-bg/50">
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <CalendarClock size={16} className="text-oc-text-muted" />
                    <span className="font-medium">{job.name}</span>
                  </div>
                </td>
                <td className="px-4 py-3 font-mono text-sm text-oc-text-muted">{job.schedule}</td>
                <td className="px-4 py-3">
                  <span
                    className={`inline-flex items-center gap-1 px-2 py-1 rounded text-xs ${
                      job.status === 'active'
                        ? 'bg-green-500/20 text-green-500'
                        : 'bg-yellow-500/20 text-yellow-500'
                    }`}
                  >
                    {job.status}
                  </span>
                </td>
                <td className="px-4 py-3 text-oc-text-muted">{job.lastRun}</td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-1">
                    <button className="p-1.5 hover:bg-oc-bg rounded transition-colors">
                      <Play size={16} className="text-oc-primary" />
                    </button>
                    <button className="p-1.5 hover:bg-oc-bg rounded transition-colors">
                      <Pause size={16} className="text-yellow-500" />
                    </button>
                    <button className="p-1.5 hover:bg-oc-bg rounded transition-colors">
                      <Trash2 size={16} className="text-red-500" />
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
