import { BookOpen, PlusSquare, Layers, User } from 'lucide-react'
import { clsx } from 'clsx'
import { useBarterStore } from '../lib/store'
import { truncAddr } from '../lib/mockData'

const TABS = [
  { id: 'market',   label: 'Market',    icon: BookOpen   },
  { id: 'propose',  label: 'Propose',   icon: PlusSquare },
  { id: 'mytrades', label: 'My Trades', icon: Layers     },
  { id: 'profile',  label: 'Profile',   icon: User       },
] as const

export default function Navigation() {
  const { activeTab, setTab, isConnected, pubKey, disconnect } = useBarterStore()

  return (
    <nav className="sticky top-0 z-40 border-b border-white/[0.06]"
         style={{ background: 'rgba(12,15,10,0.92)', backdropFilter: 'blur(16px)' }}>
      <div className="max-w-5xl mx-auto px-4 sm:px-6 flex items-center justify-between h-14">

        {/* Wordmark */}
        <button onClick={() => setTab('market')} className="flex items-center gap-2.5 group">
          <div
            className="seal-ring w-8 h-8 shrink-0"
            style={{ background: 'rgba(45,122,94,0.12)' }}
          >
            <span className="font-display text-base text-amber-lt leading-none">B</span>
          </div>
          <div>
            <div className="font-display text-base text-parchment leading-none tracking-wide">
              Barter<span className="text-gradient-teal">Ledger</span>
            </div>
            <div className="text-[9px] font-mono text-muted tracking-[0.12em] uppercase">
              Stellar · Soroban
            </div>
          </div>
        </button>

        {/* Desktop tabs */}
        <div className="hidden md:flex items-center gap-0.5 bg-black/20 rounded-sm border border-white/[0.05] p-1">
          {TABS.map(tab => {
            const Icon   = tab.icon
            const active = activeTab === tab.id
            return (
              <button
                key={tab.id}
                onClick={() => setTab(tab.id)}
                className={clsx(
                  'flex items-center gap-1.5 px-4 py-1.5 rounded-sm text-xs font-body font-medium transition-all duration-150',
                  active ? 'bg-teal/20 text-parchment border border-teal/20' : 'text-muted hover:text-parchment'
                )}
              >
                <Icon size={12} className={active ? 'text-teal' : ''} />
                {tab.label}
              </button>
            )
          })}
        </div>

        {/* Wallet */}
        {isConnected ? (
          <div className="flex items-center gap-2">
            <div className="hidden sm:flex items-center gap-2 text-xs font-mono text-muted border border-white/[0.06] rounded-sm px-3 py-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-teal animate-pulse" />
              {truncAddr(pubKey)}
            </div>
            <button onClick={disconnect} className="btn-ghost text-xs py-1.5 px-3">Disconnect</button>
          </div>
        ) : (
          <button onClick={() => setTab('profile')} className="btn-teal text-xs py-1.5 px-4">
            Connect Wallet
          </button>
        )}
      </div>

      {/* Mobile tabs */}
      <div className="md:hidden flex border-t border-white/[0.05]">
        {TABS.map(tab => {
          const Icon   = tab.icon
          const active = activeTab === tab.id
          return (
            <button
              key={tab.id}
              onClick={() => setTab(tab.id)}
              className={clsx(
                'flex-1 flex flex-col items-center gap-1 py-2 text-[9px] font-mono uppercase tracking-wide transition-colors',
                active ? 'text-parchment' : 'text-muted'
              )}
            >
              <Icon size={14} className={active ? 'text-teal' : ''} />
              {tab.label}
            </button>
          )
        })}
      </div>
    </nav>
  )
}
