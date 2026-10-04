import { formatCents } from '../format'

const sizes = {
  sm: 'text-base',
  md: 'text-xl',
  lg: 'text-[32px] leading-none',
  xl: 'text-[44px] leading-none',
  tile: 'text-[40px] leading-none',
  hero: 'text-[72px] leading-none',
} as const

type Props = {
  cents: number
  size?: keyof typeof sizes
  className?: string
}

export function Money({ cents, size = 'md', className = '' }: Props) {
  return <span className={`font-sans tabular-nums tracking-tight ${sizes[size]} ${className}`}>{formatCents(cents)}</span>
}
