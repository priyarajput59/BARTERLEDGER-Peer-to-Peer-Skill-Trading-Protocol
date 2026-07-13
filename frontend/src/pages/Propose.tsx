import { useState } from 'react'
import { Loader2, FileText, Shield, CheckCircle, Info } from 'lucide-react'
import { clsx } from 'clsx'
import { useBarterStore } from '../lib/store'
import { SKILL_TAGS, DEADLINE_OPTIONS } from '../lib/constants'
import { truncAddr } from '../lib/mockData'
import { proposeTrade } from '../lib/soroban'
export default function Propose() {
  const { isConnected, pubKey, addNotification, setTab } = useBarterStore()

  const [form, setForm] = useState({
    counterparty: '',
    serviceA: '',
    serviceB: '',
    collateral: 100,
    deadline: 604800,
    tagA: '',
    tagB: '',
  })
  const [submitting, setSubmitting] = useState(false)
  const [txHash, setTxHash]         = useState('')

  const set = (k: keyof typeof form, v: string | number) =>
    setForm(f => ({ ...f, [k]: v }))

  const handleSubmit = async () => {
    if (!isConnected) { addNotification('error', 'Connect your wallet first'); return }
    if (!form.counterparty.trim()) { addNotification('error', 'Counterparty address required'); return }
    if (form.counterparty === pubKey) { addNotification('error', 'Cannot trade with yourself'); return }
    if (!form.serviceA.trim()) { addNotification('error', 'Describe what you will offer'); return }
    if (!form.serviceB.trim()) { addNotification('error', 'Describe what you expect in return'); return }
    if (form.collateral <= 0)  { addNotification('error', 'Collateral must be positive'); return }

    setSubmitting(true)
    try {
      if (!pubKey) throw new Error('Wallet not connected');
      const hash = await proposeTrade(
        pubKey,
        form.counterparty,
        form.serviceA,
        form.serviceB,
        form.collateral.toString(),
        form.deadline
      );
      setTxHash(hash)
      addNotification('success', `Trade proposal submitted! TX: ${hash.slice(0,12)}…`)
    } catch (e) {
      addNotification('error', `Failed: ${e instanceof Error ? e.message : 'Unknown error'}`)
    } finally {
      setSubmitting(false)
    }
  }

  if (txHash) {
    return (
      <div className="max-w-lg mx-auto px-4 sm:px-6 pb-20 pt-8">
        <div className="contract-card p-8 text-center">
          <span className="watermark">SUBMITTED</span>
          <div className="seal-ring w-16 h-16 mx-auto mb-5" style={{ background: 'rgba(45,122,94,0.15)' }}>
            <CheckCircle size={28} style={{ color: '#3FA07C' }} />
          </div>
          <h2 className="font-display text-2xl text-parchment mb-2">Trade Proposed</h2>
          <p className="text-sm text-muted mb-6">
            Your proposal has been inscribed on-chain. The counterparty must accept and deposit their bond to activate the trade.
          </p>
          <div className="space-y-2 text-left mb-6">
            <div className="ledger-card p-3">
              <div className="eyebrow mb-1">Transaction Verified on Stellar Testnet</div>
              <a href={`https://stellar.expert/explorer/testnet/tx/${txHash}`} target="_blank" rel="noreferrer" className="font-mono text-[10px] text-teal break-all hover:underline">
                🔗 View on Stellar Expert: {txHash}
              </a>
            </div>
            <div className="ledger-card p-3 grid grid-cols-2 gap-4 text-xs">
              <div>
                <div className="eyebrow mb-1">You Offer</div>
                <p className="text-parchment">{form.serviceA}</p>
              </div>
              <div>
                <div className="eyebrow mb-1">You Request</div>
                <p className="text-parchment">{form.serviceB}</p>
              </div>
            </div>
            <div className="ledger-card p-3 flex items-center gap-2 text-xs">
              <Shield size={12} className="text-teal" />
              <span className="text-muted">Bond per party:</span>
              <span className="font-mono text-parchment">{form.collateral.toLocaleString()} XLM</span>
            </div>
          </div>
          <div className="flex gap-3">
            <button onClick={() => setTab('mytrades')} className="btn-teal flex-1">View My Trades</button>
            <button onClick={() => { setTxHash(''); setForm({ counterparty:'',serviceA:'',serviceB:'',collateral:100,deadline:604800,tagA:'',tagB:'' }) }} className="btn-ghost flex-1">New Proposal</button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 pb-20 pt-8">
      <div className="mb-6">
        <h1 className="font-display text-3xl text-parchment mb-1">Propose a Trade</h1>
        <p className="text-sm text-muted">Define the exchange, set your bond, and invite a counterparty.</p>
      </div>

      {!isConnected && (
        <div className="ledger-card p-4 mb-5 flex items-start gap-3" style={{ borderColor: 'rgba(196,146,42,0.25)' }}>
          <Info size={14} className="text-amber shrink-0 mt-0.5" />
          <p className="text-sm text-muted">
            Connect your wallet in <strong className="text-parchment">Profile</strong> to submit on-chain proposals.
            You can still draft a trade below.
          </p>
        </div>
      )}

      <div className="contract-card p-6 space-y-6">

        {/* Counterparty */}
        <div>
          <label className="eyebrow block mb-2">Counterparty Address <span className="text-seal">*</span></label>
          <input
            className="ledger-input font-mono text-xs"
            placeholder="G… (Stellar public key)"
            value={form.counterparty}
            onChange={e => set('counterparty', e.target.value)}
          />
        </div>

        <div className="ledger-rule" />

        {/* Services */}
        <div className="grid sm:grid-cols-2 gap-5">
          <div className="space-y-3">
            <label className="eyebrow block">
              <span className="text-teal">You Offer</span> <span className="text-seal">*</span>
            </label>
            <textarea
              className="ledger-input resize-none h-24 text-xs"
              placeholder="Describe exactly what you will deliver…"
              value={form.serviceA}
              onChange={e => set('serviceA', e.target.value)}
            />
            <select className="ledger-input text-xs" value={form.tagA} onChange={e => set('tagA', e.target.value)}>
              <option value="">Tag (optional)</option>
              {SKILL_TAGS.map(t => <option key={t} value={t} style={{ background: '#141810' }}>{t}</option>)}
            </select>
          </div>

          <div className="space-y-3">
            <label className="eyebrow block">
              <span className="text-amber">You Request</span> <span className="text-seal">*</span>
            </label>
            <textarea
              className="ledger-input resize-none h-24 text-xs"
              placeholder="Describe what you expect in return…"
              value={form.serviceB}
              onChange={e => set('serviceB', e.target.value)}
            />
            <select className="ledger-input text-xs" value={form.tagB} onChange={e => set('tagB', e.target.value)}>
              <option value="">Tag (optional)</option>
              {SKILL_TAGS.map(t => <option key={t} value={t} style={{ background: '#141810' }}>{t}</option>)}
            </select>
          </div>
        </div>

        <div className="ledger-rule" />

        {/* Collateral + deadline */}
        <div className="grid sm:grid-cols-2 gap-5">
          <div>
            <label className="eyebrow block mb-2">Good-Faith Bond (XLM each) <span className="text-seal">*</span></label>
            <input
              type="number" min={1} step={10}
              className="ledger-input font-mono"
              value={form.collateral}
              onChange={e => set('collateral', parseInt(e.target.value) || 0)}
            />
            <p className="text-[10px] text-muted mt-1.5">
              Each party deposits this. Returned on successful completion.
            </p>
          </div>
          <div>
            <label className="eyebrow block mb-2">Deadline</label>
            <select className="ledger-input" value={form.deadline} onChange={e => set('deadline', parseInt(e.target.value))}>
              {DEADLINE_OPTIONS.map(o => (
                <option key={o.value} value={o.value} style={{ background: '#141810' }}>{o.label}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Summary */}
        <div className="rounded-sm border border-dashed border-white/10 p-4 space-y-2 text-xs">
          <div className="eyebrow mb-3">Contract Preview</div>
          <div className="flex gap-2"><span className="text-muted w-24">Your address:</span><span className="font-mono text-parchment">{pubKey ? truncAddr(pubKey) : '(not connected)'}</span></div>
          <div className="flex gap-2"><span className="text-muted w-24">Counterparty:</span><span className="font-mono text-parchment">{form.counterparty ? truncAddr(form.counterparty) : '(not set)'}</span></div>
          <div className="flex gap-2"><span className="text-muted w-24">Bond (each):</span><span className="font-mono text-parchment">{form.collateral.toLocaleString()} XLM</span></div>
          <div className="flex gap-2"><span className="text-muted w-24">Total locked:</span><span className="font-mono text-amber-lt">{(form.collateral * 2).toLocaleString()} XLM</span></div>
        </div>

        <button
          onClick={handleSubmit}
          disabled={submitting}
          className={clsx('btn-amber w-full flex items-center justify-center gap-2 py-3',
            submitting && 'opacity-70 cursor-not-allowed')}
        >
          {submitting
            ? <><Loader2 size={15} className="animate-spin" /> Submitting to Soroban…</>
            : <><FileText size={15} /> Submit Trade Proposal</>
          }
        </button>
      </div>
    </div>
  )
}
