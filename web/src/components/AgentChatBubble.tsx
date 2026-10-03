import type { Message } from '../data'
import { formatCents } from '../format'

type Props = {
  from: Message['from']
  text: string
  cents?: number
}

export function AgentChatBubble({ from, text, cents }: Props) {
  if (from === 'system') {
    return (
      <p className="text-center text-sm italic text-slate2">
        {text}
        {cents != null && <span className="mt-1 block font-mono not-italic">{formatCents(cents)}</span>}
      </p>
    )
  }

  const buyer = from === 'buyer_agent'
  const name = buyer ? 'Buyer agent' : 'Seller agent'
  const mark = buyer ? 'B' : 'S'

  if (buyer) {
    return (
      <div className="flex w-full justify-end">
        <div className="max-w-[85%] rounded-2xl bg-ink px-4 py-3 text-white">
          <p className="text-xs font-medium text-white/70">{name}</p>
          <p className="mt-1 text-sm">{text}</p>
          {cents != null && <p className="mt-1 font-mono text-sm">{formatCents(cents)}</p>}
        </div>
      </div>
    )
  }

  return (
    <div className="flex w-full justify-start">
      <div className="max-w-[85%] rounded-2xl bg-[#ECFDF8] px-4 py-3 text-ink">
        <div className="flex items-center gap-2">
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-teal text-xs font-semibold text-white">
            {mark}
          </span>
          <span>
            <span className="block text-sm font-semibold">{name}</span>
            <span className="block text-xs text-slate2">A negotiation assistant</span>
          </span>
        </div>
        <p className="mt-2 text-sm">{text}</p>
        {cents != null && <p className="mt-1 font-mono text-sm">{formatCents(cents)}</p>}
        <p className="mt-2 text-[11px] text-slate2">Private to you</p>
      </div>
    </div>
  )
}
