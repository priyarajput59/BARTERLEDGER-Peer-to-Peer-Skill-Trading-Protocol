import { create } from 'zustand'

export type TradeStatus =
  'Proposed' | 'Active' | 'ConfirmedA' | 'ConfirmedB' |
  'Completed' | 'Disputed' | 'Cancelled'

export interface Trade {
  id: number
  party_a: string
  party_b: string
  service_a: string
  service_b: string
  collateral: number
  deadline: number
  status: TradeStatus
  created_at: number
  completed_at: number
  dispute_reason: string
}

export interface TraderProfile {
  trader: string
  reputation_score: number
  rank: string
  trades_completed: number
  trades_disputed: number
  dispute_streak: number
  last_activity: number
}

interface Notification {
  id: string
  type: 'success' | 'error' | 'info'
  message: string
}

interface BarterStore {
  // Wallet
  pubKey: string
  secretKey: string
  isConnected: boolean
  setWallet: (pub: string, sec: string) => void
  disconnect: () => void

  // Trades
  trades: Trade[]
  setTrades: (t: Trade[]) => void
  upsertTrade: (t: Trade) => void

  // Profile
  profile: TraderProfile | null
  setProfile: (p: TraderProfile | null) => void

  // UI
  activeTab: 'market' | 'propose' | 'mytrades' | 'profile'
  setTab: (t: 'market' | 'propose' | 'mytrades' | 'profile') => void

  // Toasts
  notifications: Notification[]
  addNotification: (type: Notification['type'], message: string) => void
  removeNotification: (id: string) => void
}

export const useBarterStore = create<BarterStore>((set, get) => ({
  pubKey: '', secretKey: '', isConnected: false,
  setWallet: (pub, sec) => set({ pubKey: pub, secretKey: sec, isConnected: true }),
  disconnect: () => set({ pubKey: '', secretKey: '', isConnected: false, profile: null, trades: [] }),

  trades: [],
  setTrades: (t) => set({ trades: t }),
  upsertTrade: (t) => set(s => {
    const idx = s.trades.findIndex(x => x.id === t.id)
    if (idx >= 0) {
      const next = [...s.trades]; next[idx] = t; return { trades: next }
    }
    return { trades: [t, ...s.trades] }
  }),

  profile: null,
  setProfile: (p) => set({ profile: p }),

  activeTab: 'market',
  setTab: (t) => set({ activeTab: t }),

  notifications: [],
  addNotification: (type, message) => {
    const id = Math.random().toString(36).slice(2)
    set(s => ({ notifications: [...s.notifications, { id, type, message }] }))
    setTimeout(() => get().removeNotification(id), 4500)
  },
  removeNotification: (id) => set(s => ({ notifications: s.notifications.filter(n => n.id !== id) })),
}))
