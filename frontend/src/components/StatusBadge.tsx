import { TRADE_STATUS_META } from '../lib/constants'
import type { TradeStatus } from '../lib/store'

interface StatusBadgeProps { status: TradeStatus }

export default function StatusBadge({ status }: StatusBadgeProps) {
  const meta = TRADE_STATUS_META[status] || TRADE_STATUS_META['Proposed']

  return (
    <span
      className="status-badge"
      style={{ color: meta.color, background: `${meta.color}15`, border: `1px solid ${meta.color}30` }}
    >
      <span
        className="w-1.5 h-1.5 rounded-full"
        style={{ background: meta.color, boxShadow: `0 0 4px ${meta.color}` }}
      />
      {meta.label}
    </span>
  )
}
