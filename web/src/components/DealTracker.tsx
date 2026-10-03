import type { DealStatus } from '../data'
import { formatCents } from '../format'

const STEPS = ['Negotiate', 'Agree', 'Escrow', 'Shipped', 'Paid'] as const

type Props = {
  status: DealStatus
  offerCents?: number
  askCents?: number
  round?: number
}

function currentStep(status: DealStatus): number | 'failed' {
  switch (status) {
    case 'negotiating':
      return 1
    case 'agreed':
    case 'funding':
      return 2
    case 'escrowed':
      return 3
    case 'shipped':
    case 'releasing':
      return 4
    case 'released':
      return 5
    case 'refunding':
    case 'refunded':
    case 'no_deal':
    case 'declined':
      return 'failed'
  }
}

export function DealTracker({ status, offerCents, askCents, round }: Props) {
  const step = currentStep(status)
  const failed = step === 'failed'
  const percent = failed ? 0 : Math.round((step / STEPS.length) * 100)
  const statusLabel = failed ? status.replaceAll('_', ' ') : STEPS[step - 1]

  return (
    <div className="rounded-2xl border border-slate-200 bg-surface p-4">
      <div className="flex items-center justify-between">
        <p className="font-semibold text-ink">Deal tracker</p>
        <span className={`flex items-center gap-1.5 text-xs font-medium ${failed ? 'text-red' : 'text-green'}`}>
          <span className={`h-1.5 w-1.5 rounded-full ${failed ? 'bg-red' : 'bg-green'}`} />
          {failed ? 'Closed' : 'Active'}
        </span>
      </div>
      <dl className="mt-4 space-y-2 text-sm">
        {offerCents != null && (
          <div className="flex justify-between">
            <dt className="text-slate2">Current offer</dt>
            <dd className="font-mono font-medium text-ink">{formatCents(offerCents)}</dd>
          </div>
        )}
        {askCents != null && (
          <div className="flex justify-between">
            <dt className="text-slate2">Asking price</dt>
            <dd className="font-mono font-medium text-ink">{formatCents(askCents)}</dd>
          </div>
        )}
        {round != null && (
          <div className="flex justify-between">
            <dt className="text-slate2">Negotiation round</dt>
            <dd className="font-semibold text-ink">Round {round}</dd>
          </div>
        )}
        <div className="flex justify-between">
          <dt className="text-slate2">Status</dt>
          <dd className="font-semibold capitalize text-ink">{statusLabel}</dd>
        </div>
      </dl>
      <div className="mt-4">
        <div className="flex justify-between text-xs text-slate2">
          <span>Progress toward agreement</span>
          <span className="font-mono">{percent}%</span>
        </div>
        <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-slate-100">
          <div className={`h-full rounded-full ${failed ? 'bg-red' : 'bg-teal'}`} style={{ width: `${percent}%` }} />
        </div>
      </div>
      <ol className="mt-3 grid grid-cols-5 gap-1">
        {STEPS.map((label, index) => {
          const number = index + 1
          const active = !failed && number === step
          return (
            <li key={label} className={`text-center text-[10px] ${active ? 'font-semibold text-ink' : 'text-slate2'}`}>
              <span className="relative inline-flex">
                {label}
                {failed && number === 1 && (
                  <span className="absolute -right-2 -top-1 h-2 w-2 rounded-full bg-red" />
                )}
              </span>
            </li>
          )
        })}
      </ol>
    </div>
  )
}
