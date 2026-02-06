import { AlertTriangle, X } from 'lucide-react'

interface DeleteConfirmDialogProps {
  isOpen: boolean
  title: string
  itemName: string
  onCancel: () => void
  onConfirm: () => void
}

export default function DeleteConfirmDialog({
  isOpen,
  title,
  itemName,
  onCancel,
  onConfirm
}: DeleteConfirmDialogProps) {
  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onCancel}
      />

      {/* Dialog */}
      <div className="relative w-full max-w-md bg-oc-surface border border-oc-border rounded-xl shadow-2xl overflow-hidden">
        {/* Close button */}
        <button
          onClick={onCancel}
          className="absolute top-4 right-4 p-1.5 text-oc-text-muted hover:text-oc-text hover:bg-oc-surface-hover rounded-lg transition-colors"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Content */}
        <div className="p-6">
          {/* Header */}
          <div className="flex items-center gap-3 mb-4">
            <div className="flex items-center justify-center w-10 h-10 rounded-full bg-red-500/10">
              <AlertTriangle className="w-5 h-5 text-red-500" />
            </div>
            <h3 className="text-lg font-semibold text-red-500">{title}</h3>
          </div>

          {/* Message */}
          <p className="text-sm text-oc-text-muted leading-relaxed mb-6">
            Are you sure you want to delete{' '}
            <span className="font-semibold text-oc-text">{itemName}</span>?{' '}
            This action cannot be undone.
          </p>

          {/* Actions */}
          <div className="flex items-center justify-end gap-3">
            <button
              onClick={onCancel}
              className="px-4 py-2 text-sm font-medium text-oc-text bg-oc-surface-hover hover:bg-oc-border rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={onConfirm}
              className="px-4 py-2 text-sm font-medium text-white bg-red-500 hover:bg-red-600 rounded-lg transition-colors"
            >
              Delete
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
