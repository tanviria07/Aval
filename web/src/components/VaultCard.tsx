import { Lock } from 'lucide-react'
import { formatCents } from '../format'

type Props = {
  priceCents: number
}

export function VaultCard({ priceCents }: Props) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-surface p-5 text-ink">
      <div className="flex items-center justify-between">
        <span className="flex h-9 w-9 items-center justify-center rounded-full bg-[#ECFDF8] text-teal">
          <Lock className="h-4 w-4" aria-hidden="true" />
        </span>
        <span className="flex items-center gap-1.5 text-xs font-medium text-green">
          <span className="h-1.5 w-1.5 rounded-full bg-green" />
          Sealed
        </span>
      </div>
      <h3 className="mt-4 text-lg font-semibold">Protected deal terms</h3>
      <p className="mt-1 text-sm text-slate2">Released when delivery is confirmed.</p>
      <p className="mt-4 text-xs text-slate2">Held safely</p>
      <p className="font-mono text-3xl font-medium">{formatCents(priceCents)}</p>
    </div>
  )
}
