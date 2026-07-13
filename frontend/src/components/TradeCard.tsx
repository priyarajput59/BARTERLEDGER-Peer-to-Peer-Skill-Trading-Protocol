import { ArrowLeftRight, Clock, Shield, AlertTriangle, CheckCircle } from 'lucide-react'
import type { Trade } from '../lib/store'
import StatusBadge from './StatusBadge'
import { truncAddr, formatXLM, deadlineLabel, formatDate } from '../lib/mockData'
import { useBarterStore } from '../lib/store'
import { acceptTrade, confirmDelivery } from '../lib/soroban'

interface TradeCardProps {
  trade: Trade
  compact?: boolean
}

export default function TradeCard({ trade, compact = false }: TradeCardProps) {
  const { pubKey, isConnected, addNotification } = useBarterStore()

  const canAccept  = isConnected && trade.party_b === pubKey && trade.status === 'Proposed'
  const canConfirm = isConnected && trade.status === 'Active' &&
    (trade.party_a === pubKey || trade.party_b === pubKey)
  const canDispute = isConnected && ['Active','ConfirmedA','ConfirmedB'].includes(trade.status) &&
    (trade.party_a === pubKey || trade.party_b === pubKey)

  const handleAccept = async () => {
    addNotification('info', `Accepting trade #${trade.id} and locking collateral…`)
    await new Promise(r => setTimeout(r, 1500))
    addNotification('success', `Trade #${trade.id} accepted! Collateral of ${formatXLM(trade.collateral)} locked on-chain.`)
  }

  const handleConfirm = async () => {
    addNotification('info', `Confirming delivery for trade #${trade.id}…`)
    await new Promise(r => setTimeout(r, 1200))
    addNotification('success', `Delivery confirmed! Both parties confirmed → trade will complete.`)
  }

  const handleDispute = async () => {
    addNotification('info', `Raising dispute for trade #${trade.id}…`)
    await new Promise(r => setTimeout(r, 1000))
    addNotification('error', `Dispute raised. Reputation ledger has been notified.`)
  }

  return (
    <div className="contract-card p-5 group transition-all duration-200 hover:border-amber/30">
      <span className="watermark">LEDGER</span>

      {/* Header */}
      <div className="flex items-start justify-between mb-4">
        <div>
          <span className="eyebrow">Trade #{String(trade.id).padStart(4, '0')}</span>
          <div className="text-[10px] font-mono text-muted mt-0.5">{formatDate(trade.created_at)}</div>
        </div>
        <div className="flex flex-col items-end gap-1.5">
          <StatusBadge status={trade.status} />
          {trade.deadline > 0 && trade.status !== 'Completed' && trade.status !== 'Cancelled' && (
            <div className="flex items-center gap-1 text-[10px] font-mono text-muted">
              <Clock size={9} />
              {deadlineLabel(trade.deadline)}
            </div>
          )}
        </div>
      </div>

      {/* Services exchange */}
      <div className={`grid gap-3 mb-4 ${compact ? 'grid-cols-1' : 'grid-cols-[1fr_auto_1fr]'} items-center`}>
        <div className="ledger-card p-3">
          <div className="eyebrow mb-1.5">Party A offers</div>
          <p className="text-sm text-parchment leading-snug">{trade.service_a}</p>
          <div className="mt-2 font-mono text-[10px] text-teal">{truncAddr(trade.party_a)}</div>
        </div>

        {!compact && (
          <div className="flex flex-col items-center gap-1 shrink-0">
            <ArrowLeftRight size={16} className="text-teal-lt opacity-70" />
          </div>
        )}

        <div className="ledger-card p-3">
          <div className="eyebrow mb-1.5">Party B offers</div>
          <p className="text-sm text-parchment leading-snug">{trade.service_b}</p>
          <div className="mt-2 font-mono text-[10px] text-amber">{truncAddr(trade.party_b)}</div>
        </div>
      </div>

      {/* Collateral + dispute */}
      <div className="flex items-center justify-between text-xs">
        <div className="flex items-center gap-1.5 text-muted">
          <Shield size={11} className="text-teal" />
          <span className="font-mono">{formatXLM(trade.collateral)} bond (each party)</span>
        </div>
        {trade.status === 'Completed' && (
          <div className="flex items-center gap-1 text-[10px] font-mono" style={{ color: '#3FA07C' }}>
            <CheckCircle size={10} />
            Settled {formatDate(trade.completed_at)}
          </div>
        )}
        {trade.status === 'Disputed' && (
          <div className="flex items-center gap-1 text-[10px] font-mono text-seal">
            <AlertTriangle size={10} />
            {trade.dispute_reason.slice(0, 30)}{trade.dispute_reason.length > 30 ? '…' : ''}
          </div>
        )}
      </div>

      {/* Actions */}
      {!compact && (canAccept || canConfirm || canDispute) && (
        <div className="flex gap-2 mt-4 pt-4 border-t border-dashed border-white/[0.07]">
          {canAccept  && <button onClick={handleAccept}  className="btn-amber text-xs py-2 px-4">Accept & Lock Bond</button>}
          {canConfirm && <button onClick={handleConfirm} className="btn-teal text-xs py-2 px-4">Confirm Delivery</button>}
          {canDispute && <button onClick={handleDispute} className="btn-ghost text-xs py-2 px-4 border-seal/30 text-seal hover:border-seal/50">Raise Dispute</button>}
        </div>
      )}
    </div>
  )
}
