import { CheckCircle, XCircle, Info, X } from 'lucide-react'
import { useBarterStore } from '../lib/store'

export default function Notifications() {
  const { notifications, removeNotification } = useBarterStore()
  if (!notifications.length) return null

  return (
    <div className="fixed bottom-6 right-6 z-50 flex flex-col gap-2 w-full max-w-sm">
      {notifications.map(n => (
        <div
          key={n.id}
          className="ledger-card flex items-start gap-3 p-4"
          style={{
            borderColor: n.type === 'success' ? 'rgba(45,122,94,0.4)'
                       : n.type === 'error'   ? 'rgba(139,32,32,0.4)'
                       :                        'rgba(196,146,42,0.3)',
          }}
        >
          {n.type === 'success' && <CheckCircle size={15} className="shrink-0 mt-0.5" style={{ color: '#3FA07C' }} />}
          {n.type === 'error'   && <XCircle     size={15} className="shrink-0 mt-0.5 text-seal" />}
          {n.type === 'info'    && <Info         size={15} className="shrink-0 mt-0.5 text-amber" />}
          <p className="text-sm text-parchment flex-1 leading-snug">{n.message}</p>
          <button onClick={() => removeNotification(n.id)} className="text-muted hover:text-parchment transition-colors shrink-0">
            <X size={13} />
          </button>
        </div>
      ))}
    </div>
  )
}
