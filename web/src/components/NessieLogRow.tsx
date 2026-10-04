import type { NessieLog } from '../data'

type Props = {
  log: NessieLog
}

function formatClock(at: number) {
  return new Date(Number(at) / 1000).toLocaleTimeString('en-GB', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  })
}

export function NessieLogRow({ log }: Props) {
  const ok = log.status >= 200 && log.status < 300

  return (
    <div className="flex items-center gap-3 rounded-full border border-slate-200 bg-surface px-3 py-2 font-mono text-sm text-ink">
      <span className="shrink-0 text-slate2">{formatClock(log.at)}</span>
      <span className="shrink-0">{log.method}</span>
      <span className="min-w-0 flex-1 truncate">{log.path}</span>
      <span className="shrink-0 text-slate2">{log.note}</span>
      <span className={`flex shrink-0 items-center gap-1 text-xs font-medium ${ok ? 'text-green' : 'text-red'}`}>
        <span className={`h-1.5 w-1.5 rounded-full ${ok ? 'bg-green' : 'bg-red'}`} />
        {ok ? 'Success' : log.status}
      </span>
    </div>
  )
}
