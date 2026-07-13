import { useState } from 'react'
import { Loader2, Copy, ExternalLink, TrendingUp, AlertTriangle, CheckCircle } from 'lucide-react'
import { isConnected as isFreighterConnected, requestAccess, getAddress, signMessage } from '@stellar/freighter-api'
import { useBarterStore } from '../lib/store'
import RankBadge from '../components/RankBadge'
import { MOCK_PROFILES, formatDate } from '../lib/mockData'
import { RANK_META } from '../lib/constants'

export default function Profile() {
  const { isConnected, pubKey, setWallet, disconnect, setProfile, addNotification } = useBarterStore()
  const [loading, setLoading]         = useState(false)

  const handleConnect = async () => {
    setLoading(true)
    try {
      const installed = await isFreighterConnected()
      if (!installed) {
        addNotification('error', 'Freighter wallet is not installed. Please install the browser extension.')
        return
      }

      const accessObj = await requestAccess()
      if (accessObj.error) {
        addNotification('error', 'Connection request denied')
        return
      }

      const addressObj = await getAddress()
      if (addressObj.error || !addressObj.address) {
        addNotification('error', 'Could not retrieve wallet address')
        return
      }

      const pk = addressObj.address
      const sigObj = await signMessage('Log in to BarterLedger')
      if (sigObj.error) {
        addNotification('error', 'Signature request denied')
        return
      }

      setWallet(pk)
      
      const mock = MOCK_PROFILES.find(p => p.trader === pk) || {
        trader: pk, reputation_score: 0, rank: 'Newcomer',
        trades_completed: 0, trades_disputed: 0, dispute_streak: 0, last_activity: Date.now() / 1000,
      }
      setProfile(mock)
      addNotification('success', 'Wallet connected successfully!')
    } catch {
      addNotification('error', 'Failed to connect wallet')
    } finally {
      setLoading(false)
    }
  }

  const copy = (s: string) => { navigator.clipboard.writeText(s); addNotification('info', 'Copied!') }

  if (!isConnected) {
    return (
      <div className="max-w-md mx-auto px-4 sm:px-6 pb-20 pt-8">
        <div className="mb-8 text-center">
          <div className="seal-ring w-16 h-16 mx-auto mb-4" style={{ background: 'rgba(45,122,94,0.12)' }}>
            <span className="font-display text-2xl text-amber-lt">⬡</span>
          </div>
          <h1 className="font-display text-3xl text-parchment mb-2">Connect Wallet</h1>
          <p className="text-sm text-muted">Connect your Freighter wallet to start trading on BarterLedger.</p>
        </div>

        <div className="contract-card p-6 space-y-4">
          <button onClick={handleConnect} disabled={loading} className="btn-teal w-full flex items-center justify-center gap-2">
            {loading ? <><Loader2 size={14} className="animate-spin" /> Waiting for Freighter…</> : 'Connect Freighter'}
          </button>
        </div>
      </div>
    )
  }

  // Use demo profile data
  const profile = MOCK_PROFILES[0]
  const meta    = RANK_META[profile?.rank || 'Newcomer']

  // Score progress to next rank
  const rankOrder = ['Newcomer','Apprentice','Journeyman','Craftsman','Artisan','GrandMaster']
  const currentIdx = rankOrder.indexOf(profile?.rank || 'Newcomer')
  const nextRank   = rankOrder[currentIdx + 1]
  const nextMeta   = nextRank ? RANK_META[nextRank] : null
  const progress   = nextMeta
    ? Math.min(((profile?.reputation_score || 0) - meta.min) / (nextMeta.min - meta.min) * 100, 100)
    : 100

  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 pb-20 pt-8 space-y-5">

      {/* Wallet */}
      <div className="contract-card p-5">
        <div className="eyebrow mb-3">Connected Wallet</div>
        <div className="flex items-center justify-between gap-4">
          <div className="font-mono text-xs text-parchment break-all flex-1">{pubKey}</div>
          <div className="flex gap-2 shrink-0">
            <button onClick={() => copy(pubKey)} className="btn-ghost py-1.5 px-2"><Copy size={12} /></button>
            <a href={`https://stellar.expert/explorer/testnet/account/${pubKey}`} target="_blank" rel="noopener noreferrer" className="btn-ghost py-1.5 px-2">
              <ExternalLink size={12} />
            </a>
          </div>
        </div>
        <div className="flex items-center gap-2 mt-3">
          <span className="w-1.5 h-1.5 rounded-full bg-teal animate-pulse" />
          <span className="eyebrow">Testnet · Active</span>
        </div>
      </div>

      {/* Reputation score card */}
      {profile && (
        <div className="contract-card p-6">
          <div className="eyebrow mb-4">Reputation Ledger</div>
          <div className="flex items-center gap-5 mb-5">
            <div className="seal-ring w-20 h-20 shrink-0 flex-col" style={{ background: `${meta.color}10` }}>
              <div className="font-display text-2xl font-bold" style={{ color: meta.color }}>{profile.reputation_score}</div>
              <div className="text-[9px] font-mono text-muted">pts</div>
            </div>
            <div className="space-y-2">
              <RankBadge rank={profile.rank} size="lg" />
              <div className="text-xs text-muted">Last activity: {formatDate(profile.last_activity)}</div>
            </div>
          </div>

          {/* Progress to next rank */}
          {nextMeta && (
            <div className="mb-5">
              <div className="flex items-center justify-between text-[10px] font-mono text-muted mb-1.5">
                <span>{meta.label}</span>
                <span>{nextMeta.label} ({nextMeta.min} pts)</span>
              </div>
              <div className="h-1.5 bg-white/[0.06] rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-500"
                  style={{ width: `${progress}%`, background: `linear-gradient(90deg, ${meta.color}, ${nextMeta.color})` }}
                />
              </div>
            </div>
          )}

          <div className="grid grid-cols-3 gap-3">
            <div className="ledger-card p-3 text-center">
              <CheckCircle size={14} className="text-teal mx-auto mb-1" />
              <div className="font-display text-xl text-parchment">{profile.trades_completed}</div>
              <div className="eyebrow">Completed</div>
            </div>
            <div className="ledger-card p-3 text-center">
              <AlertTriangle size={14} className="text-seal mx-auto mb-1" />
              <div className="font-display text-xl text-parchment">{profile.trades_disputed}</div>
              <div className="eyebrow">Disputed</div>
            </div>
            <div className="ledger-card p-3 text-center">
              <TrendingUp size={14} className="text-amber mx-auto mb-1" />
              <div className="font-display text-xl text-parchment">{profile.dispute_streak}</div>
              <div className="eyebrow">Streak</div>
            </div>
          </div>
        </div>
      )}

      {/* Scoring info */}
      <div className="ledger-card p-5">
        <div className="eyebrow mb-3">How Scores Are Calculated</div>
        <div className="space-y-2 text-xs text-muted">
          <div className="flex gap-3"><span className="text-teal font-mono w-24">+100 base</span><span>per completed trade</span></div>
          <div className="flex gap-3"><span className="text-teal font-mono w-24">+25 streak</span><span>every 5 completed trades (max +200)</span></div>
          <div className="flex gap-3"><span className="text-seal font-mono w-24">−30× streak</span><span>per dispute (escalates with consecutive disputes)</span></div>
          <div className="flex gap-3"><span className="text-amber-lt font-mono w-24">0 penalty</span><span>completing a trade resets your dispute streak</span></div>
        </div>
      </div>

      <button onClick={disconnect} className="btn-ghost w-full border-seal/20 text-seal hover:border-seal/40">
        Disconnect Wallet
      </button>
    </div>
  )
}
