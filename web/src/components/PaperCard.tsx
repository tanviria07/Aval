import type { ReactNode } from 'react'

type Props = {
  children: ReactNode
  className?: string
  tilt?: boolean
  edge?: string
}

export function PaperCard({ children, className = '', tilt = false, edge = '#F4ECDD' }: Props) {
  return (
    <div className={`relative bg-paper-2 shadow-scrap ${tilt ? '-rotate-[0.5deg]' : ''} ${className}`}>
      {children}
      <svg
        className="pointer-events-none absolute -bottom-px left-0 h-3 w-full"
        viewBox="0 0 400 12"
        preserveAspectRatio="none"
        aria-hidden
      >
        <path
          fill={edge}
          d="M0 12V7c8-6 12-6 20 0s12 6 20 0 12-6 20 0 12 6 20 0 12-6 20 0 12 6 20 0 12-6 20 0 12 6 20 0 12-6 20 0 12 6 20 0 12-6 20 0 12 6 20 0 12-6 20 0 12 6 20 0 12-6 20 0 12 6 20 0 12-6 20 0 12 6 20 0 12-6 20 0V12H0Z"
        />
      </svg>
    </div>
  )
}
