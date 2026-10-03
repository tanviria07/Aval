import { mockMembers, type Listing } from '../data'
import { formatCents } from '../format'

type Props = {
  listing: Listing
  onNegotiate: () => void
}

const STATUS_LABEL = {
  open: 'Available',
  in_deal: 'In deal',
  sold: 'Sold',
} as const

export function ListingCard({ listing, onNegotiate }: Props) {
  const seller = mockMembers.find((member) => member.id === listing.sellerId)

  return (
    <article className="overflow-hidden rounded-2xl border border-slate-200 bg-surface text-left shadow-sm">
      <div className="flex h-36 items-center justify-center bg-[#E2E8F0] text-5xl">{listing.emoji}</div>
      <div className="p-4">
        <p className="flex items-center gap-1.5 text-xs font-medium text-green">
          <span className="h-1.5 w-1.5 rounded-full bg-green" />
          {STATUS_LABEL[listing.status]}
        </p>
        <h3 className="mt-2 text-base font-semibold text-ink">{listing.title}</h3>
        <div className="mt-3 flex items-end justify-between gap-3">
          <div>
            <p className="text-xs text-slate2">Asking price</p>
            <p className="font-mono text-2xl font-medium text-ink">{formatCents(listing.listCents)}</p>
          </div>
          <p className="text-right text-xs text-slate2">
            Sold by
            <span className="mt-0.5 block font-medium text-ink">{seller?.name ?? 'Seller'}</span>
          </p>
        </div>
        <button
          type="button"
          onClick={onNegotiate}
          className="mt-4 h-12 w-full rounded-xl bg-teal text-sm font-semibold text-white"
        >
          Start negotiation →
        </button>
      </div>
    </article>
  )
}
