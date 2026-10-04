import { parseReasons } from '../data'

export function ReasonList({ reasonsJson, tone = 'ink' }: { reasonsJson: string; tone?: 'ink' | 'light' }) {
  const reasons = parseReasons(reasonsJson)
  if (reasons.length === 0) return null
  const text = tone === 'light' ? 'text-white/80' : 'text-ink'
  const points = tone === 'light' ? 'text-white/55' : 'text-muted'
  return (
    <ul className="flex flex-col gap-3">
      {reasons.map(reason => (
        <li key={`${reason.code}-${reason.source}`} className="flex items-start gap-3 text-base">
          <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-held" aria-hidden />
          <span className={`min-w-0 flex-1 ${text}`}>{reason.text}</span>
          <span className={`shrink-0 font-mono tabular-nums ${points}`}>{reason.points > 0 ? `+${reason.points}` : reason.points}</span>
        </li>
      ))}
    </ul>
  )
}
