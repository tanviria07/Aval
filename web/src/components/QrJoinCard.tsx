import { Lock } from 'lucide-react'

export function QrJoinCard() {
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
      <h3 className="mt-4 text-lg font-semibold">Join this negotiation</h3>
      <p className="mt-1 text-sm text-slate2">Scan the QR code or enter the code below.</p>
      <div className="mt-4 flex h-28 items-center justify-center rounded-xl border border-dashed border-slate-300 font-mono text-sm text-slate2">
        QR
      </div>
      <div className="mt-4 flex h-12 items-center justify-center rounded-xl bg-teal text-sm font-semibold text-white">
        Join negotiation
      </div>
    </div>
  )
}
