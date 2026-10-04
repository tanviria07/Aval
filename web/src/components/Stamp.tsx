import type { PaymentStatus } from '../data'

const tones = {
  red: 'border-stamp text-stamp',
  mustard: 'border-mustard text-mustard-ink',
  blue: 'border-blue text-blue',
  sage: 'border-sage-ink text-sage-ink',
  sepia: 'border-sepia text-sepia',
} as const

type Tone = keyof typeof tones

const byStatus: Record<PaymentStatus, { label: string; tone: Tone }> = {
  cleared: { label: 'Sent', tone: 'sepia' },
  sent: { label: 'Sent', tone: 'sepia' },
  holding: { label: 'Held by the bank', tone: 'red' },
  held: { label: 'Held by the bank', tone: 'red' },
  objection: { label: 'Releasing soon', tone: 'mustard' },
  releasing: { label: 'Released', tone: 'blue' },
  released: { label: 'Released', tone: 'blue' },
  refunding: { label: 'Returned home', tone: 'sage' },
  refunded: { label: 'Returned home', tone: 'sage' },
  failed: { label: 'Needs attention', tone: 'red' },
}

export function Stamp({ label, tone = 'sepia', className = '' }: { label: string; tone?: Tone; className?: string }) {
  return (
    <span className={`stamp font-type text-xs uppercase tracking-wide ${tones[tone]} ${className}`}>{label}</span>
  )
}

export function StatusPill({ status, className = '' }: { status: PaymentStatus; className?: string }) {
  const stamp = byStatus[status]
  return <Stamp label={stamp.label} tone={stamp.tone} className={className} />
}
