import { Zap, Plus, Play, Settings } from 'lucide-react'

export default function Skills() {
  const skills = [
    { name: 'Code Review', description: 'Review code for bugs and improvements', status: 'active' },
    { name: 'Documentation', description: 'Generate documentation from code', status: 'inactive' },
    { name: 'Testing', description: 'Generate and run tests', status: 'active' },
  ]

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Skills</h1>
          <p className="text-oc-text-muted mt-1">
            Manage agent skills and capabilities.
          </p>
        </div>
        <button className="flex items-center gap-2 px-4 py-2 bg-oc-primary text-white rounded-lg hover:bg-oc-primary-hover transition-colors">
          <Plus size={18} />
          <span className="text-sm font-medium">Add Skill</span>
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {skills.map((skill) => (
          <div
            key={skill.name}
            className="bg-oc-surface rounded-xl border border-oc-border p-4"
          >
            <div className="flex items-start justify-between mb-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-oc-bg flex items-center justify-center">
                  <Zap size={20} className="text-yellow-500" />
                </div>
                <div>
                  <h3 className="font-medium">{skill.name}</h3>
                  <span
                    className={`text-xs ${
                      skill.status === 'active' ? 'text-green-500' : 'text-gray-400'
                    }`}
                  >
                    {skill.status}
                  </span>
                </div>
              </div>
            </div>
            <p className="text-sm text-oc-text-muted mb-4">{skill.description}</p>
            <div className="flex items-center gap-2">
              <button className="flex-1 flex items-center justify-center gap-1 px-3 py-1.5 bg-oc-bg rounded-lg text-sm hover:bg-oc-surface-hover transition-colors">
                <Play size={14} />
                Run
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
