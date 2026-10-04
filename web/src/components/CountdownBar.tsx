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
  className?: string
}

export function CountdownBar({ endsAt, large = false, className = '' }: Props) {
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
      <p className={`font-serif tabular-nums text-mustard-ink ${large ? 'text-[64px] leading-none' : 'text-4xl leading-none'}`}>{formatLeft(left)}</p>
      <div className="ticket-tear mt-3 h-3 w-full bg-paper">
        <div className="h-full bg-mustard" style={{ width: `${ratio * 100}%` }} />
      </div>
    </div>
  )
}
