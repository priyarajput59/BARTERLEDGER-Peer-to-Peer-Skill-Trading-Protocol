import type { Trade, TraderProfile } from './store'

export function truncAddr(addr: string, n = 6): string {
  return `${addr.slice(0, n)}…${addr.slice(-4)}`
}

export function formatXLM(stroops: number): string {
  return (stroops / 10_000_000).toLocaleString(undefined, { maximumFractionDigits: 0 }) + ' XLM'
}

export function deadlineLabel(ts: number): string {
  const diff = ts - Math.floor(Date.now() / 1000)
  if (diff <= 0) return 'Expired'
  const d = Math.floor(diff / 86400)
  const h = Math.floor((diff % 86400) / 3600)
  if (d > 0) return `${d}d ${h}h left`
  return `${h}h left`
}

export function formatDate(ts: number): string {
  if (!ts) return '—'
  return new Date(ts * 1000).toLocaleDateString('en-US', {
    year: 'numeric', month: 'short', day: 'numeric',
  })
}

// ─── Mock data ────────────────────────────────────────────────────────────────

const A = 'GDQP2KPQGKIHYJGXNUIYOMHARUARCA7DJT5FO2FFOOKY3B2WSQHG4W37'
const B = 'GBUHRWJBKGRAOXA5VD4DQNWH7NG3QKZXHQMK6QNMKK2FOPWWK3UXPBS'
const C = 'GCEZWKCA5VLDNRLN3RPRJMRZOX3Z6G5CHCGB9ABODAZDBEKVX7BBHPS'
const D = 'GBHSCSZBKS5SFXNM5OLZJR4E2MGBDKJBCQZQKGXFB5MBVKX4IIYOQK'

export const MOCK_TRADES: Trade[] = [
  {
    id: 0, party_a: A, party_b: B,
    service_a: 'Soroban smart contract (ERC-20 equivalent)',
    service_b: 'Full Figma design system with 40+ components',
    collateral: 500_0000000, deadline: Math.floor(Date.now()/1000) + 432000,
    status: 'Active', created_at: Math.floor(Date.now()/1000) - 86400,
    completed_at: 0, dispute_reason: '',
  },
  {
    id: 1, party_a: B, party_b: C,
    service_a: 'SEO audit + 6-month keyword strategy',
    service_b: 'Brand identity (logo, palette, type guide)',
    collateral: 200_0000000, deadline: Math.floor(Date.now()/1000) + 864000,
    status: 'Proposed', created_at: Math.floor(Date.now()/1000) - 3600,
    completed_at: 0, dispute_reason: '',
  },
  {
    id: 2, party_a: C, party_b: D,
    service_a: 'React Native mobile app (MVP)',
    service_b: '20 custom illustrations (SVG)',
    collateral: 1000_0000000, deadline: Math.floor(Date.now()/1000) + 1728000,
    status: 'ConfirmedA', created_at: Math.floor(Date.now()/1000) - 604800,
    completed_at: 0, dispute_reason: '',
  },
  {
    id: 3, party_a: D, party_b: A,
    service_a: 'Tokenomics whitepaper',
    service_b: 'Video explainer (2 min, animated)',
    collateral: 300_0000000, deadline: Math.floor(Date.now()/1000) - 86400,
    status: 'Completed', created_at: Math.floor(Date.now()/1000) - 1209600,
    completed_at: Math.floor(Date.now()/1000) - 86400, dispute_reason: '',
  },
  {
    id: 4, party_a: A, party_b: C,
    service_a: 'DevOps & CI/CD pipeline setup',
    service_b: 'Technical documentation (10 pages)',
    collateral: 150_0000000, deadline: Math.floor(Date.now()/1000) + 259200,
    status: 'Disputed', created_at: Math.floor(Date.now()/1000) - 259200,
    completed_at: 0, dispute_reason: 'Deliverable quality below agreed standard',
  },
]

export const MOCK_PROFILES: TraderProfile[] = [
  { trader: A, reputation_score: 1240, rank: 'GrandMaster', trades_completed: 11, trades_disputed: 0, dispute_streak: 0, last_activity: Math.floor(Date.now()/1000) - 3600 },
  { trader: B, reputation_score: 875,  rank: 'Artisan',     trades_completed: 7,  trades_disputed: 1, dispute_streak: 0, last_activity: Math.floor(Date.now()/1000) - 7200 },
  { trader: C, reputation_score: 540,  rank: 'Journeyman',  trades_completed: 5,  trades_disputed: 2, dispute_streak: 1, last_activity: Math.floor(Date.now()/1000) - 86400 },
  { trader: D, reputation_score: 300,  rank: 'Journeyman',  trades_completed: 3,  trades_disputed: 0, dispute_streak: 0, last_activity: Math.floor(Date.now()/1000) - 172800 },
]
