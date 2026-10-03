import type { Role } from '../data'
import { formatCents } from '../format'

type Props = {
  bidCents: number
  askCents: number
  listCents: number
  myLimitCents?: number
  role: Role
}

function percent(part: number, total: number) {
  if (total <= 0) return 0
  return Math.min(100, Math.max(0, (part / total) * 100))
}

export function ConvergenceBar({ bidCents, askCents, listCents, myLimitCents, role }: Props) {
  const bidPct = percent(bidCents, listCents)
  const askPct = percent(askCents, listCents)
  const crossed = bidCents >= askCents
  const gap = Math.abs(askCents - bidCents)
  const limitPct = myLimitCents == null ? null : percent(myLimitCents, listCents)
  const zone =
    limitPct == null
      ? null
      : role === 'buyer'
        ? { left: `${limitPct}%`, width: `${100 - limitPct}%` }
        : { left: '0%', width: `${limitPct}%` }

  return (
    <div className={`rounded-2xl border border-slate-200 bg-surface p-4 ${crossed ? 'glow' : ''}`}>
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold text-ink">Finding common ground</p>
        <span className="h-2 w-2 rounded-full bg-green" />
      </div>
      <div className="mt-4 flex items-end justify-between">
        <div>
          <p className="text-xs text-slate2">Buyer</p>
          <p className="font-mono text-xl font-medium text-ink">{formatCents(bidCents)}</p>
        </div>
        <div className="text-right">
          <p className="text-xs text-slate2">Seller</p>
          <p className="font-mono text-xl font-medium text-ink">{formatCents(askCents)}</p>
        </div>
      </div>
      <div className="relative mt-4 h-3 rounded-full bg-slate-100">
        {zone && (
          <div
            className="absolute inset-y-0"
            style={{
              ...zone,
              backgroundImage:
                'repeating-linear-gradient(-45deg, rgba(11,18,32,0.22) 0 4px, transparent 4px 8px)',
            }}
          />
        )}
        <div className="absolute inset-y-0 left-0 rounded-full bg-teal" style={{ width: `${bidPct}%` }} />
        <span
          className="absolute top-1/2 h-3.5 w-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white bg-amber"
          style={{ left: `${bidPct}%` }}
          title="Buyer bid"
        />
        <span
          className="absolute top-1/2 h-3.5 w-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white bg-ink"
          style={{ left: `${askPct}%` }}
          title="Seller ask"
        />
      </div>
      <div className="mt-3 flex items-center justify-between text-sm">
        <span className="text-slate2">Gap</span>
        <span className="font-mono font-medium text-ink">{formatCents(gap)}</span>
      </div>
    </div>
  )
}
