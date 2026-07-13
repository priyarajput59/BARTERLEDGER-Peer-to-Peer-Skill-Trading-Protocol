import { RANK_META } from '../lib/constants'

interface RankBadgeProps {
  rank: string
  size?: 'sm' | 'md' | 'lg'
  showGlyph?: boolean
}

export default function RankBadge({ rank, size = 'md', showGlyph = true }: RankBadgeProps) {
  const meta  = RANK_META[rank] || RANK_META['Newcomer']
  const sizes = { sm: 'text-[10px] px-2 py-0.5', md: 'text-xs px-3 py-1', lg: 'text-sm px-4 py-1.5' }

  return (
    <span
      className={`rank-badge font-display ${sizes[size]}`}
      style={{ color: meta.color, borderColor: `${meta.color}40`, background: `${meta.color}10` }}
    >
      {showGlyph && <span className="font-mono">{meta.glyph}</span>}
      {meta.label}
    </span>
  )
}
