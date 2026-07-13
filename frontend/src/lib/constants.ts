export const NETWORK_PASSPHRASE  = 'Test SDF Network ; September 2015'
export const SOROBAN_RPC_URL     = 'https://soroban-testnet.stellar.org'
export const HORIZON_URL         = 'https://horizon-testnet.stellar.org'
export const FRIENDBOT_URL       = 'https://friendbot.stellar.org'

export const TRADE_VAULT_ID      = import.meta.env.VITE_TRADE_VAULT_ID      || ''
export const REPUTATION_LEDGER_ID= import.meta.env.VITE_REPUTATION_LEDGER_ID|| ''
export const TOKEN_ID            = import.meta.env.VITE_TOKEN_ID             || ''

export const RANK_META: Record<string, { label: string; color: string; glyph: string; min: number }> = {
  Newcomer:   { label: 'Newcomer',    color: '#5A6454', glyph: '✦',  min: 0    },
  Apprentice: { label: 'Apprentice',  color: '#8FA882', glyph: '✧✦', min: 100  },
  Journeyman: { label: 'Journeyman',  color: '#2D7A5E', glyph: '⬡',  min: 300  },
  Craftsman:  { label: 'Craftsman',   color: '#3FA07C', glyph: '⬡⬡', min: 600  },
  Artisan:    { label: 'Artisan',     color: '#C4922A', glyph: '❋',  min: 1000 },
  GrandMaster:{ label: 'Grand Master',color: '#E0AA3E', glyph: '❋❋', min: 1800 },
}

export const TRADE_STATUS_META: Record<string, { label: string; color: string; desc: string }> = {
  Proposed:   { label: 'Awaiting Acceptance', color: '#8FA882', desc: 'Waiting for counterparty' },
  Active:     { label: 'In Progress',         color: '#2D7A5E', desc: 'Collateral locked, work ongoing' },
  ConfirmedA: { label: 'Awaiting B',          color: '#C4922A', desc: 'Party A confirmed delivery' },
  ConfirmedB: { label: 'Awaiting A',          color: '#C4922A', desc: 'Party B confirmed delivery' },
  Completed:  { label: 'Completed',           color: '#3FA07C', desc: 'Trade settled, collateral returned' },
  Disputed:   { label: 'Disputed',            color: '#8B2020', desc: 'Under dispute resolution' },
  Cancelled:  { label: 'Cancelled',           color: '#5A6454', desc: 'Trade was cancelled' },
}

export const SKILL_TAGS = [
  'Web Development', 'Mobile App', 'Smart Contract', 'UI/UX Design',
  'Logo & Branding', 'Copywriting', 'SEO Audit', 'Video Editing',
  'Illustration', 'Data Analysis', 'DevOps', 'Technical Writing',
  'Photography', 'Music Production', '3D Modeling', 'Translation',
  'Solidity Audit', 'Rust Development', 'Soroban Contract', 'Tokenomics',
]

export const DEADLINE_OPTIONS = [
  { label: '3 days',   value: 259200  },
  { label: '1 week',   value: 604800  },
  { label: '2 weeks',  value: 1209600 },
  { label: '1 month',  value: 2592000 },
  { label: '3 months', value: 7776000 },
]
