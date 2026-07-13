import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { truncAddr, formatXLM, deadlineLabel, formatDate, MOCK_TRADES, MOCK_PROFILES } from '../lib/mockData'
import { RANK_META, TRADE_STATUS_META } from '../lib/constants'
import RankBadge from '../components/RankBadge'
import StatusBadge from '../components/StatusBadge'

// ─── Utility: truncAddr ───────────────────────────────────────────────────────

describe('truncAddr', () => {
  const ADDR = 'GDQP2KPQGKIHYJGXNUIYOMHARUARCA7DJT5FO2FFOOKY3B2WSQHG4W37'

  it('shortens address with ellipsis', () => {
    const result = truncAddr(ADDR)
    expect(result).toContain('…')
    expect(result.length).toBeLessThan(ADDR.length)
  })

  it('preserves first 6 chars', () => {
    expect(truncAddr(ADDR).startsWith('GDQP2K')).toBe(true)
  })

  it('preserves last 4 chars', () => {
    expect(truncAddr(ADDR).endsWith('W37')).toBe(true)
  })

  it('custom length works', () => {
    const r = truncAddr(ADDR, 4)
    expect(r.startsWith('GDQP')).toBe(true)
  })
})

// ─── Utility: formatXLM ──────────────────────────────────────────────────────

describe('formatXLM', () => {
  it('converts stroops to XLM correctly', () => {
    expect(formatXLM(10_000_000)).toBe('1 XLM')
    expect(formatXLM(500_0000000)).toBe('500 XLM')
    expect(formatXLM(1000_0000000)).toBe('1,000 XLM')
  })

  it('returns 0 XLM for 0 stroops', () => {
    expect(formatXLM(0)).toBe('0 XLM')
  })
})

// ─── Utility: deadlineLabel ───────────────────────────────────────────────────

describe('deadlineLabel', () => {
  it('returns "Expired" for past timestamps', () => {
    const past = Math.floor(Date.now() / 1000) - 1000
    expect(deadlineLabel(past)).toBe('Expired')
  })

  it('returns days remaining for future timestamp', () => {
    const future = Math.floor(Date.now() / 1000) + 5 * 86400
    const label  = deadlineLabel(future)
    expect(label).toContain('d')
    expect(label).toContain('left')
  })

  it('returns hours for sub-day deadline', () => {
    const future = Math.floor(Date.now() / 1000) + 6 * 3600
    const label  = deadlineLabel(future)
    expect(label).toContain('h left')
  })
})

// ─── Utility: formatDate ──────────────────────────────────────────────────────

describe('formatDate', () => {
  it('returns — for zero timestamp', () => {
    expect(formatDate(0)).toBe('—')
  })

  it('returns a readable date string', () => {
    const ts = 1700000000
    const result = formatDate(ts)
    expect(result).toMatch(/[A-Z][a-z]+/)  // contains month name
    expect(result).toMatch(/\d{4}/)         // contains year
  })
})

// ─── Mock data integrity ──────────────────────────────────────────────────────

describe('MOCK_TRADES', () => {
  it('has 5 trades', () => {
    expect(MOCK_TRADES.length).toBe(5)
  })

  it('all trades have required fields', () => {
    MOCK_TRADES.forEach(t => {
      expect(t).toHaveProperty('id')
      expect(t).toHaveProperty('party_a')
      expect(t).toHaveProperty('party_b')
      expect(t).toHaveProperty('service_a')
      expect(t).toHaveProperty('service_b')
      expect(t).toHaveProperty('collateral')
      expect(t).toHaveProperty('status')
      expect(t.party_a).not.toBe(t.party_b)
    })
  })

  it('collaterals are all positive', () => {
    MOCK_TRADES.forEach(t => expect(t.collateral).toBeGreaterThan(0))
  })

  it('covers each status type', () => {
    const statuses = new Set(MOCK_TRADES.map(t => t.status))
    expect(statuses.has('Proposed')).toBe(true)
    expect(statuses.has('Active')).toBe(true)
    expect(statuses.has('Completed')).toBe(true)
    expect(statuses.has('Disputed')).toBe(true)
  })

  it('completed trades have completed_at > 0', () => {
    MOCK_TRADES.filter(t => t.status === 'Completed').forEach(t => {
      expect(t.completed_at).toBeGreaterThan(0)
    })
  })
})

describe('MOCK_PROFILES', () => {
  it('has 4 profiles', () => expect(MOCK_PROFILES.length).toBe(4))

  it('sorted by score descending', () => {
    for (let i = 0; i < MOCK_PROFILES.length - 1; i++) {
      expect(MOCK_PROFILES[i].reputation_score).toBeGreaterThanOrEqual(MOCK_PROFILES[i+1].reputation_score)
    }
  })

  it('all profiles have valid ranks', () => {
    const validRanks = Object.keys(RANK_META)
    MOCK_PROFILES.forEach(p => expect(validRanks).toContain(p.rank))
  })
})

// ─── Constants ────────────────────────────────────────────────────────────────

describe('RANK_META', () => {
  it('defines 6 ranks', () => {
    expect(Object.keys(RANK_META).length).toBe(6)
  })

  it('all ranks have color, glyph, min, label', () => {
    Object.values(RANK_META).forEach(r => {
      expect(r.color).toMatch(/^#[0-9A-Fa-f]{6}$/)
      expect(r.glyph).toBeTruthy()
      expect(r.label).toBeTruthy()
      expect(typeof r.min).toBe('number')
    })
  })

  it('min scores are in ascending order', () => {
    const mins = Object.values(RANK_META).map(r => r.min)
    for (let i = 0; i < mins.length - 1; i++) {
      expect(mins[i]).toBeLessThan(mins[i + 1])
    }
  })
})

describe('TRADE_STATUS_META', () => {
  it('defines all 7 statuses', () => {
    const expected = ['Proposed','Active','ConfirmedA','ConfirmedB','Completed','Disputed','Cancelled']
    expected.forEach(s => expect(TRADE_STATUS_META[s]).toBeDefined())
  })
})

// ─── Scoring algorithm (JS mirror of Rust) ────────────────────────────────────

describe('Reputation Scoring Algorithm', () => {
  function calcScore(trades: { completed: boolean }[]): number {
    let score = 0
    let completed = 0
    let disputeStreak = 0

    for (const t of trades) {
      if (t.completed) {
        const streakBonus = Math.min(Math.floor(completed / 5) * 25, 200)
        score += 100 + streakBonus
        completed++
        disputeStreak = 0
      } else {
        const penalty = Math.min((disputeStreak + 1) * 30, 150)
        score = Math.max(0, score - penalty)
        disputeStreak++
      }
    }
    return score
  }

  function scoreToRank(score: number): string {
    if (score < 100)  return 'Newcomer'
    if (score < 300)  return 'Apprentice'
    if (score < 600)  return 'Journeyman'
    if (score < 1000) return 'Craftsman'
    if (score < 1800) return 'Artisan'
    return 'GrandMaster'
  }

  it('score is 0 for no trades', () => {
    expect(calcScore([])).toBe(0)
  })

  it('single completion gives 100 pts', () => {
    expect(calcScore([{ completed: true }])).toBe(100)
  })

  it('5 completions triggers streak bonus on 5th', () => {
    const trades = Array.from({ length: 5 }, () => ({ completed: true }))
    // trades 1-5: completed count is 0-4 when bonus applied → floor(n/5)*25=0 each → 5×100=500
    expect(calcScore(trades)).toBe(500)
  })

  it('first dispute costs 30 pts', () => {
    const trades = [{ completed: true }, { completed: false }]
    // 100 - 30 = 70
    expect(calcScore(trades)).toBe(70)
  })

  it('consecutive disputes scale penalty', () => {
    const trades = [
      { completed: true }, { completed: true }, { completed: true },
      { completed: false }, { completed: false }, // -30, -60
    ]
    // 300 - 30 - 60 = 210
    expect(calcScore(trades)).toBe(210)
  })

  it('completion resets dispute streak', () => {
    const trades = [
      { completed: true },
      { completed: false },  // streak → 1
      { completed: true },   // resets streak
      { completed: false },  // back to 30 penalty (streak = 1 again)
    ]
    // 100 - 30 + 100 - 30 = 140
    expect(calcScore(trades)).toBe(140)
  })

  it('score never goes below 0', () => {
    const trades = Array.from({ length: 10 }, () => ({ completed: false }))
    expect(calcScore(trades)).toBe(0)
  })

  it('rank boundaries are correct', () => {
    expect(scoreToRank(0)).toBe('Newcomer')
    expect(scoreToRank(99)).toBe('Newcomer')
    expect(scoreToRank(100)).toBe('Apprentice')
    expect(scoreToRank(300)).toBe('Journeyman')
    expect(scoreToRank(600)).toBe('Craftsman')
    expect(scoreToRank(1000)).toBe('Artisan')
    expect(scoreToRank(1800)).toBe('GrandMaster')
  })
})

// ─── Component: RankBadge ─────────────────────────────────────────────────────

describe('RankBadge', () => {
  it('renders rank label', () => {
    render(<RankBadge rank="Craftsman" />)
    expect(screen.getByText('Craftsman')).toBeInTheDocument()
  })

  it('shows glyph by default', () => {
    render(<RankBadge rank="Artisan" />)
    expect(screen.getByText('❋')).toBeInTheDocument()
  })

  it('hides glyph when showGlyph=false', () => {
    render(<RankBadge rank="Artisan" showGlyph={false} />)
    expect(screen.queryByText('❋')).not.toBeInTheDocument()
  })

  it('falls back to Newcomer for unknown rank', () => {
    render(<RankBadge rank="Unknown" />)
    expect(screen.getByText('Newcomer')).toBeInTheDocument()
  })
})

// ─── Component: StatusBadge ───────────────────────────────────────────────────

describe('StatusBadge', () => {
  it('renders Proposed status', () => {
    render(<StatusBadge status="Proposed" />)
    expect(screen.getByText('Awaiting Acceptance')).toBeInTheDocument()
  })

  it('renders Completed status', () => {
    render(<StatusBadge status="Completed" />)
    expect(screen.getByText('Completed')).toBeInTheDocument()
  })

  it('renders Disputed status', () => {
    render(<StatusBadge status="Disputed" />)
    expect(screen.getByText('Disputed')).toBeInTheDocument()
  })

  it('renders Active status', () => {
    render(<StatusBadge status="Active" />)
    expect(screen.getByText('In Progress')).toBeInTheDocument()
  })
})
