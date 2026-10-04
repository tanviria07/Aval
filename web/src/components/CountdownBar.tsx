import { useEffect, useState } from 'react'

const WINDOW_MS = 60_000

export function objectionEndsAt(paymentId: string, active: boolean) {
  if (!active) return null
  const key = `aval-objection-${paymentId}`
  const saved = Number(sessionStorage.getItem(key))
  if (Number.isFinite(saved) && saved > Date.now() - 2000) return saved
  const next = Date.now() + WINDOW_MS
  sessionStorage.setItem(key, String(next))
  return next
}

function formatLeft(ms: number) {
  const total = Math.max(0, Math.ceil(ms / 1000))
  const minutes = Math.floor(total / 60)
  const seconds = total % 60
  return `${minutes}:${seconds.toString().padStart(2, '0')}`
}

type Props = {
  endsAt: number
  large?: boolean
  surface?: 'light' | 'dark'
  className?: string
}

export function CountdownBar({ endsAt, large = false, surface = 'light', className = '' }: Props) {
  const [now, setNow] = useState(Date.now())

  useEffect(() => {
    let frame = 0
    const tick = () => {
      setNow(Date.now())
      frame = requestAnimationFrame(tick)
    }
    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [endsAt])

  const left = Math.max(0, endsAt - now)
  const ratio = Math.min(1, left / WINDOW_MS)

  return (
    <div className={className}>
      <p className={`tabular-nums font-sans text-release ${large ? 'text-[64px] leading-none' : 'text-3xl'}`}>{formatLeft(left)}</p>
      <div className={`mt-3 h-2 w-full overflow-hidden rounded-full ${surface === 'dark' ? 'bg-white/15' : 'bg-line'}`}>
        <div className="h-full rounded-full bg-release transition-[width] duration-vault ease-vault" style={{ width: `${ratio * 100}%` }} />
      </div>
    </div>
  )
}
