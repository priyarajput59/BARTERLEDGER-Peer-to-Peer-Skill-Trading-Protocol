import { useState } from 'react'
import { Search, TrendingUp, Users, CheckSquare, ArrowLeftRight } from 'lucide-react'
import TradeCard from '../components/TradeCard'
import RankBadge from '../components/RankBadge'
import { MOCK_TRADES, MOCK_PROFILES, truncAddr, formatXLM } from '../lib/mockData'
import { useBarterStore } from '../lib/store'
import type { TradeStatus } from '../lib/store'

const STATUS_FILTERS: { label: string; value: TradeStatus | 'all' }[] = [
  { label: 'All',       value: 'all'      },
  { label: 'Open',      value: 'Proposed' },
  { label: 'Active',    value: 'Active'   },
  { label: 'Completed', value: 'Completed'},
]

export default function Market() {
  const { setTab } = useBarterStore()
  const [search, setSearch]   = useState('')
  const [filter, setFilter]   = useState<TradeStatus | 'all'>('all')

  const filtered = MOCK_TRADES.filter(t => {
    const matchFilter = filter === 'all' || t.status === filter
    const matchSearch = !search || [t.service_a, t.service_b].some(s =>
      s.toLowerCase().includes(search.toLowerCase())
    )
    return matchFilter && matchSearch
  })

  const stats = [
    { label: 'Active Trades',    value: MOCK_TRADES.filter(t => t.status === 'Active').length,    icon: ArrowLeftRight },
    { label: 'Completed',        value: MOCK_TRADES.filter(t => t.status === 'Completed').length, icon: CheckSquare    },
    { label: 'Total Volume',     value: '3,150 XLM',                                              icon: TrendingUp     },
    { label: 'Registered Traders',value: MOCK_PROFILES.length,                                    icon: Users          },
  ]

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 pb-20 pt-8 space-y-10">

      {/* Hero */}
      <section className="relative">
        <div className="absolute inset-0 bg-teal-glow pointer-events-none" />
        <div className="absolute inset-0 bg-amber-glow pointer-events-none" />
        <div className="relative text-center py-8">
          <p className="eyebrow mb-4">Stellar Soroban · Testnet</p>
          <h1 className="font-display text-4xl sm:text-6xl text-parchment mb-4 leading-tight">
            Trade Skills,<br />
            <span className="text-gradient-teal italic">Not Money.</span>
          </h1>
          <p className="max-w-lg mx-auto text-muted text-sm leading-relaxed mb-8">
            BarterLedger is a peer-to-peer skill exchange protocol.
            Lock a good-faith bond, deliver your service, build your on-chain reputation.
            No middlemen. No platforms. Just two wallets and a contract.
          </p>
          <div className="flex items-center justify-center gap-3">
            <button onClick={() => setTab('propose')} className="btn-amber">Propose a Trade</button>
            <button onClick={() => setTab('profile')} className="btn-ghost">View My Reputation</button>
          </div>
        </div>
      </section>

      {/* Stats */}
      <section className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {stats.map(s => {
          const Icon = s.icon
          return (
            <div key={s.label} className="ledger-card p-4 flex items-center gap-3">
              <div className="w-8 h-8 rounded-sm bg-teal/10 border border-teal/20 flex items-center justify-center shrink-0">
                <Icon size={14} className="text-teal" />
              </div>
              <div>
                <div className="font-display text-xl text-parchment">{s.value}</div>
                <div className="eyebrow mt-0.5">{s.label}</div>
              </div>
            </div>
          )
        })}
      </section>

      {/* How it works */}
      <section>
        <p className="eyebrow mb-5 text-center">How It Works</p>
        <div className="grid sm:grid-cols-3 gap-4">
          {[
            { n: '01', title: 'Propose', desc: 'Describe what you offer and what you want in return. Set a collateral bond as a commitment.' },
            { n: '02', title: 'Execute', desc: 'Counterparty accepts and both bonds lock on-chain. Deliver your service within the deadline.' },
            { n: '03', title: 'Settle',  desc: 'Both confirm delivery. Bonds return instantly. The Reputation Ledger records your track record.' },
          ].map(step => (
            <div key={step.n} className="ledger-card p-5">
              <div className="font-mono text-3xl text-teal/30 font-bold mb-3">{step.n}</div>
              <h3 className="font-display text-lg text-parchment mb-2">{step.title}</h3>
              <p className="text-sm text-muted leading-relaxed">{step.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Trade list */}
      <section>
        <div className="flex flex-col sm:flex-row gap-3 mb-5">
          <div className="relative flex-1">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
            <input
              className="ledger-input pl-9"
              placeholder="Search services…"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
          <div className="flex gap-1 border border-white/[0.06] rounded-sm p-1 bg-black/20">
            {STATUS_FILTERS.map(f => (
              <button
                key={f.value}
                onClick={() => setFilter(f.value)}
                className={`px-3 py-1.5 rounded-sm text-xs font-mono transition-all ${
                  filter === f.value ? 'bg-teal/20 text-parchment border border-teal/20' : 'text-muted hover:text-parchment'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-4">
          {filtered.length === 0 ? (
            <div className="ledger-card p-12 text-center text-muted">
              <p className="font-display text-lg mb-2 text-parchment">No trades found</p>
              <p className="text-sm">Try adjusting your filters or propose a new trade.</p>
            </div>
          ) : (
            filtered.map(trade => <TradeCard key={trade.id} trade={trade} />)
          )}
        </div>
      </section>

      {/* Top traders */}
      <section>
        <p className="eyebrow mb-5">Top Traders by Reputation</p>
        <div className="ledger-card overflow-hidden">
          <div className="grid grid-cols-[auto_1fr_auto_auto] gap-x-4 p-3 border-b border-white/[0.06]">
            <span className="eyebrow">#</span>
            <span className="eyebrow">Trader</span>
            <span className="eyebrow hidden sm:block">Rank</span>
            <span className="eyebrow">Score</span>
          </div>
          {MOCK_PROFILES.map((p, i) => (
            <div key={p.trader} className="grid grid-cols-[auto_1fr_auto_auto] gap-x-4 items-center p-3 border-b border-white/[0.03] hover:bg-white/[0.01] transition-colors">
              <span className="font-mono text-sm text-muted w-5">{i + 1}</span>
              <div>
                <div className="font-mono text-sm text-parchment">{truncAddr(p.trader)}</div>
                <div className="text-[10px] text-muted">{p.trades_completed} completed</div>
              </div>
              <div className="hidden sm:block"><RankBadge rank={p.rank} size="sm" /></div>
              <div className="font-display text-sm text-amber-lt">{p.reputation_score}</div>
            </div>
          ))}
        </div>
      </section>

    </div>
  )
}
