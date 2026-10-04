import { parseReasons } from '../data'

export function ReasonList({ reasonsJson }: { reasonsJson: string }) {
  const reasons = parseReasons(reasonsJson)
  if (reasons.length === 0) return null
  return (
    <ul className="mt-3 flex flex-col gap-2">
      {reasons.map(reason => (
        <li key={`${reason.code}-${reason.source}`} className="rounded-full bg-canvas px-3 py-1 text-xs text-ink">
          {reason.text}
          <span className="ml-2 font-mono text-slate2">
            {reason.points > 0 ? `+${reason.points}` : reason.points} · {reason.source}
          </span>
        </li>
      ))}
    </ul>
  )
}
