import type { PaymentStatus } from '../data'

const pills: Record<PaymentStatus, { label: string; className: string }> = {
  cleared: { label: 'Sent', className: 'bg-line text-ink' },
  sent: { label: 'Sent', className: 'bg-line text-ink' },
  holding: { label: 'Held by your bank', className: 'bg-held-bg text-held' },
  held: { label: 'Held by your bank', className: 'bg-held-bg text-held' },
  objection: { label: 'Releasing soon', className: 'bg-release-bg text-release' },
  releasing: { label: 'Released', className: 'bg-release-bg text-release' },
  released: { label: 'Released', className: 'bg-release-bg text-release' },
  refunding: { label: 'Returned home', className: 'bg-home-bg text-home' },
  refunded: { label: 'Returned home', className: 'bg-home-bg text-home' },
  failed: { label: 'Needs attention', className: 'bg-alert-bg text-alert' },
}

export function StatusPill({ status, className = '' }: { status: PaymentStatus; className?: string }) {
  const pill = pills[status]
  return (
    <span className={`inline-flex items-center rounded-full px-3 py-1 text-sm font-medium ${pill.className} ${className}`}>
      {pill.label}
    </span>
  )
}
