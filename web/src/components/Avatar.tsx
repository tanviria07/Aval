const tones = ['#E4D3C4', '#D9C7B0', '#E7D5D2', '#D5D0C4', '#E2D4C2']

function toneFor(name: string) {
  let hash = 0
  for (const char of name) hash = (hash * 31 + char.charCodeAt(0)) >>> 0
  return tones[hash % tones.length]
}

type Props = {
  name: string
  online?: boolean
  size?: number
  className?: string
}

export function Avatar({ name, online, size = 40, className = '' }: Props) {
  const initial = name.trim().charAt(0).toUpperCase() || '?'
  return (
    <span className={`relative inline-flex shrink-0 ${className}`} style={{ width: size, height: size }}>
      <span
        className="flex h-full w-full items-center justify-center rounded-full font-medium text-ink"
        style={{ background: toneFor(name), fontSize: Math.max(14, Math.round(size * 0.38)) }}
      >
        {initial}
      </span>
      {online != null && (
        <span
          className={`absolute bottom-0 right-0 rounded-full ring-2 ring-paper ${online ? 'bg-sage-ink' : 'bg-sepia'}`}
          style={{ width: Math.max(8, Math.round(size * 0.28)), height: Math.max(8, Math.round(size * 0.28)) }}
          aria-label={online ? 'Online' : 'Offline'}
        />
      )}
    </span>
  )
}
