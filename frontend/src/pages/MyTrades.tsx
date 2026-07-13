import { useState, useEffect } from 'react'
import TradeCard from '../components/TradeCard'
import { useBarterStore } from '../lib/store'
import type { TradeStatus } from '../lib/store'
import { clsx } from 'clsx'
import { fetchUserTrades } from '../lib/soroban'

const TABS: { label: string; value: TradeStatus | 'all' }[] = [
  { label: 'All',       value: 'all'       },
  { label: 'Active',    value: 'Active'    },
  { label: 'Pending',   value: 'Proposed'  },
  { label: 'Completed', value: 'Completed' },
  { label: 'Disputed',  value: 'Disputed'  },
]

export default function MyTrades() {
  const { isConnected, pubKey, setTab, trades, setTrades } = useBarterStore()
  const [filter, setFilter] = useState<TradeStatus | 'all'>('all')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    let mounted = true
    if (isConnected && pubKey) {
      const load = async () => {
        try {
          const fetchedTrades = await fetchUserTrades(pubKey)
          if (mounted) {
            setTrades(fetchedTrades)
            setLoading(false)
          }
        } catch (err) {
          console.error(err)
          if (mounted) setLoading(false)
        }
      }
      load()
    }
    return () => { mounted = false }
  }, [isConnected, pubKey, setTrades])

  if (!isConnected) {
    return (
      <div className="max-w-md mx-auto px-4 sm:px-6 pb-20 pt-16 text-center">
        <div className="ledger-card p-10">
          <div className="font-display text-4xl text-teal/30 mb-4">⊘</div>
          <h2 className="font-display text-xl text-parchment mb-2">No wallet connected</h2>
          <p className="text-sm text-muted mb-6">Connect your Stellar wallet to view your trades.</p>
          <button onClick={() => setTab('profile')} className="btn-teal">Connect Wallet</button>
        </div>
      </div>
    )
  }

  const filtered = trades.filter(t => filter === 'all' || t.status === filter)

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 pb-20 pt-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="font-display text-3xl text-parchment">My Trades</h1>
          <p className="text-sm text-muted mt-1">{trades.length} trades on record {loading && '(Loading...)'}</p>
        </div>
        <button onClick={() => setTab('propose')} className="btn-amber text-xs py-2">+ New Trade</button>
      </div>

      {/* Filter tabs */}
      <div className="flex gap-1 mb-5 border-b border-white/[0.06] pb-1 overflow-x-auto">
        {TABS.map(t => (
          <button
            key={t.value}
            onClick={() => setFilter(t.value)}
            className={clsx(
              'px-4 py-1.5 text-xs font-mono whitespace-nowrap transition-all rounded-sm',
              filter === t.value ? 'text-parchment bg-teal/15 border border-teal/20' : 'text-muted hover:text-parchment'
            )}
          >
            {t.label}
            <span className="ml-1.5 text-muted">
              ({t.value === 'all' ? trades.length : trades.filter(x => x.status === t.value).length})
            </span>
          </button>
        ))}
      </div>

      <div className="space-y-4">
        {filtered.length === 0 ? (
          <div className="ledger-card p-10 text-center">
            <p className="font-display text-lg text-parchment mb-2">No trades in this category</p>
            <p className="text-sm text-muted">Propose a new trade to get started.</p>
          </div>
        ) : (
          filtered.map(trade => <TradeCard key={trade.id} trade={trade} />)
        )}
      </div>
    </div>
  )
}
