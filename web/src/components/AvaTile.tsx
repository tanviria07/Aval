type Props = {
  speaking: boolean
}

export function AvaTile({ speaking }: Props) {
  return (
    <div className="flex flex-col items-center gap-3 text-center">
      <div
        className={`flex h-24 w-24 items-center justify-center rounded-full bg-gradient-to-br from-violet to-[#ddd6fe] text-4xl font-semibold text-white ${
          speaking ? 'glow' : ''
        }`}
      >
        A
      </div>
      <div>
        <p className="text-lg font-semibold text-ink">Ava</p>
        <p className="text-sm text-slate2">Deal host</p>
      </div>
    </div>
  )
}
