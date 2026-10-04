import type { ReactNode } from 'react'

type Props = {
  id: string
  children: ReactNode
  className?: string
  punch?: string
}

export function TicketStub({ id, children, className = '', punch = '#F4ECDD' }: Props) {
  const number = id.padStart(4, '0')
  return (
    <article
      className={`relative bg-paper-2 py-5 pl-8 pr-5 text-ink shadow-scrap ${className}`}
      style={{
        backgroundImage: `radial-gradient(circle at 0 12px, ${punch} 7px, transparent 7.5px)`,
        backgroundSize: '16px 22px',
        backgroundRepeat: 'repeat-y',
      }}
    >
      <p className="font-type text-xs tracking-wide text-sepia">PAYMENT No. {number}</p>
      {children}
    </article>
  )
}
