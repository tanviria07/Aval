import type { ButtonHTMLAttributes, ReactNode } from 'react'
import { LoaderCircle } from 'lucide-react'

const variants = {
  primary: 'bg-ink text-white',
  approve: 'bg-release text-white',
  stop: 'border border-alert bg-white text-alert',
  quiet: 'border border-line bg-white text-ink',
} as const

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: keyof typeof variants
  pending?: boolean
  children: ReactNode
}

export function Button({ variant = 'primary', pending = false, className = '', children, disabled, ...props }: Props) {
  return (
    <button
      type="button"
      disabled={disabled || pending}
      className={`inline-flex min-h-14 w-full items-center justify-center gap-2 rounded-btn px-4 text-base font-medium transition-colors duration-vault ease-vault disabled:opacity-40 ${variants[variant]} ${className}`}
      {...props}
    >
      {pending && <LoaderCircle className="animate-spin" size={18} strokeWidth={1.75} aria-hidden />}
      {children}
    </button>
  )
}
