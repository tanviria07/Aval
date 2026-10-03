import { Lock } from 'lucide-react'

type Props = {
  label: string
  value: string
  onChange: (value: string) => void
}

export function SealedLimitInput({ label, value, onChange }: Props) {
  return (
    <label className="block text-left">
      <span className="text-[11px] font-semibold tracking-[0.14em] text-teal">ONLY YOU & YOUR AGENT</span>
      <span className="mt-1 block text-sm font-semibold text-ink">{label}</span>
      <div className="mt-2 flex h-12 items-center gap-2 rounded-xl border border-teal bg-surface px-3 focus-within:border-amber">
        <span className="font-mono text-ink">$</span>
        <input
          value={value}
          onChange={(event) => onChange(event.target.value)}
          inputMode="decimal"
          className="w-full bg-transparent font-mono text-lg text-ink outline-none"
          placeholder="0.00"
        />
        <Lock className="h-4 w-4 shrink-0 text-slate2" aria-hidden="true" />
      </div>
      <p className="mt-2 flex items-start gap-1.5 text-xs text-slate2">
        <Lock className="mt-0.5 h-3 w-3 shrink-0" aria-hidden="true" />
        This limit stays private. The seller only sees offers your agent makes.
      </p>
    </label>
  )
}
