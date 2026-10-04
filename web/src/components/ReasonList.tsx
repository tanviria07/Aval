import { parseReasons } from '../data'

export function ReasonList({ reasonsJson, tone = 'ink' }: { reasonsJson: string; tone?: 'ink' | 'light' }) {
  const reasons = parseReasons(reasonsJson)
  if (reasons.length === 0) return null
  const text = tone === 'light' ? 'text-paper' : 'text-ink'
  const points = tone === 'light' ? 'text-paper/80' : 'text-sepia'
  return (
    <ul className="flex flex-col gap-2">
      {reasons.map(reason => (
        <li key={`${reason.code}-${reason.source}`} className="flex items-start gap-3 font-type text-sm">
          <span className={`mt-1 h-1.5 w-1.5 shrink-0 rounded-full ${tone === 'light' ? 'bg-mustard' : 'bg-stamp'}`} aria-hidden />
          <span className={`min-w-0 flex-1 ${text}`}>{reason.text}</span>
          <span className={`shrink-0 tabular-nums ${points}`}>{reason.points > 0 ? `+${reason.points}` : reason.points}</span>
        </li>
      ))}
    </ul>
  )
}
