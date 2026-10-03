import { motion } from 'framer-motion'
import { Lock } from 'lucide-react'
import { formatCents } from '../format'

type Props = {
  step: 1 | 2 | 3
  amountCents?: number
}

const STOPS = ['Buyer', 'Ava', 'Seller'] as const

export function MoneyFlowStrip({ step, amountCents }: Props) {
  const left = step === 1 ? '16.666%' : step === 2 ? '50%' : '83.333%'

  return (
    <div className="text-ink">
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold">Transaction flow</p>
        <span className="flex items-center gap-1.5 text-xs font-medium text-green">
          <span className="h-1.5 w-1.5 rounded-full bg-green" />
          Escrow
        </span>
      </div>
      <div className="mt-4 grid grid-cols-3 text-center">
        {STOPS.map((label) => (
          <div key={label}>
            <p className="text-xs text-slate2">{label}</p>
            {amountCents != null && <p className="font-mono text-sm font-medium">{formatCents(amountCents)}</p>}
          </div>
        ))}
      </div>
      <div className="relative mt-3 h-8">
        <div className="absolute left-[16.666%] right-[16.666%] top-1/2 h-px bg-slate-300" />
        <span className="absolute left-1/3 top-1/2 -translate-x-1/2 -translate-y-1/2 text-xs text-slate2">→</span>
        <span className="absolute left-2/3 top-1/2 -translate-x-1/2 -translate-y-1/2 text-xs text-slate2">→</span>
        <motion.div
          className="absolute top-1/2 h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full bg-teal shadow"
          initial={false}
          animate={{ left }}
          transition={{ type: 'spring', stiffness: 180, damping: 20 }}
          aria-label="Funds"
        />
      </div>
      <p className="mt-2 flex items-start gap-1.5 text-xs text-slate2">
        <Lock className="mt-0.5 h-3 w-3 shrink-0" aria-hidden="true" />
        Funds are held in escrow until the seller accepts the current offer.
      </p>
    </div>
  )
}
