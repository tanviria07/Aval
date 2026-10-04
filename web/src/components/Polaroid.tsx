import { WashiTape } from './WashiTape'

const tones = ['#E4D3C4', '#D9C7B0', '#E7D5D2', '#D5D0C4', '#E2D4C2']

function toneFor(name: string) {
  let hash = 0
  for (const char of name) hash = (hash * 31 + char.charCodeAt(0)) >>> 0
  return tones[hash % tones.length]
}

type Props = {
  name: string
  online?: boolean
  className?: string
}

export function Polaroid({ name, online, className = '' }: Props) {
  const initial = name.trim().charAt(0).toUpperCase() || '?'
  const first = name.trim().split(' ')[0] || name
  return (
    <figure className={`relative w-[92px] shrink-0 bg-white px-2 pb-7 pt-2 shadow-scrap ${online === false ? 'opacity-40' : ''} ${className}`}>
      <WashiTape className="-top-2 left-1 w-14" />
      <div
        className="relative flex aspect-square items-center justify-center font-serif text-2xl text-ink"
        style={{ background: toneFor(name) }}
      >
        {initial}
        {online && <span className="absolute bottom-1 right-1 h-2.5 w-2.5 rounded-full bg-sage-ink" aria-label="Online" />}
      </div>
      <figcaption className="absolute inset-x-1 bottom-1 truncate text-center font-script text-lg leading-none text-ink">{first}</figcaption>
    </figure>
  )
}
