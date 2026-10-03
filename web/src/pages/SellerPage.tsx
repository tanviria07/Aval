import { useState } from 'react'
import { AgentChatBubble } from '../components/AgentChatBubble'
import { ConvergenceBar } from '../components/ConvergenceBar'
import { DealTracker } from '../components/DealTracker'
import { SealedLimitInput } from '../components/SealedLimitInput'
import {
  accept,
  createListing,
  decline,
  markShipped,
  mockListings,
  mockMessages,
} from '../data'
import { dollarsToCents, formatCents } from '../format'
import { updateLive, useLive } from '../liveDeal'

export function SellerPage() {
  const { deal, limits } = useLive()
  const listing = mockListings.find((item) => item.id === deal.listingId)
  const messages = mockMessages.filter((message) => message.dealId === deal.id)
  const [title, setTitle] = useState('')
  const [emoji, setEmoji] = useState('')
  const [listPrice, setListPrice] = useState('')
  const [floor, setFloor] = useState('')
  const [tracking, setTracking] = useState(deal.tracking ?? '')
  const [created, setCreated] = useState(false)

  const mine = deal.sellerId === 'm1'
  const showShip = deal.status === 'escrowed'
  const showDecision = deal.status === 'negotiating' || deal.status === 'agreed' || deal.status === 'funding'

  function onCreate() {
    const listCents = dollarsToCents(listPrice)
    const floorCents = dollarsToCents(floor)
    if (!title.trim() || listCents == null || floorCents == null) return
    createListing(title.trim(), emoji.trim() || '📦', listCents, floorCents)
    updateLive({}, { floorCents })
    setCreated(true)
  }

  function onAccept() {
    accept(deal.id)
    const sellerAccepted = true
    const both = sellerAccepted && deal.buyerAccepted
    updateLive({
      sellerAccepted,
      status: both ? 'escrowed' : deal.status,
      priceCents: both ? deal.askCents : deal.priceCents,
    })
  }

  function onDecline() {
    decline(deal.id)
    updateLive({ status: 'declined', sellerAccepted: false })
  }

  function onShipped() {
    if (!tracking.trim()) return
    markShipped(deal.id, tracking.trim())
    updateLive({ status: 'shipped', tracking: tracking.trim() })
  }

  return (
    <main className="min-h-screen bg-canvas px-4 py-8 text-ink">
      <div className="mx-auto flex max-w-lg flex-col gap-6">
        <header>
          <p className="text-sm font-semibold tracking-[0.2em] text-teal">AVAL</p>
          <h1 className="mt-1 text-3xl font-semibold">Seller</h1>
        </header>

        <section className="rounded-2xl bg-surface p-5 text-ink">
          <h2 className="text-lg font-semibold">Create listing</h2>
          <label className="mt-4 block text-sm font-medium">
            Title
            <input
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              className="mt-1 h-12 w-full rounded-xl border border-slate-300 px-3 outline-none focus:border-amber"
              placeholder="Trek road bike"
            />
          </label>
          <label className="mt-4 block text-sm font-medium">
            Emoji
            <input
              value={emoji}
              onChange={(event) => setEmoji(event.target.value)}
              className="mt-1 h-12 w-full rounded-xl border border-slate-300 px-3 outline-none focus:border-amber"
              placeholder="🚴"
            />
          </label>
          <label className="mt-4 block text-sm font-medium">
            List price
            <input
              value={listPrice}
              onChange={(event) => setListPrice(event.target.value)}
              inputMode="decimal"
              className="mt-1 h-12 w-full rounded-xl border border-slate-300 px-3 font-mono outline-none focus:border-amber"
              placeholder="400.00"
            />
          </label>
          <div className="mt-4">
            <SealedLimitInput label="Floor" value={floor} onChange={setFloor} />
          </div>
          <button
            type="button"
            onClick={onCreate}
            className="mt-4 h-12 w-full rounded-xl bg-teal text-sm font-semibold text-white"
          >
            Create
          </button>
          {created && <p className="mt-3 text-sm text-slate2">Listing created. Your floor stays in the vault.</p>}
        </section>

        {mine && listing && (
          <section className="flex flex-col gap-4 rounded-2xl bg-surface p-5 text-ink">
            <div>
              <h2 className="text-lg font-semibold">Live deal</h2>
              <p className="text-sm text-slate2">
                {listing.emoji} {listing.title} · list {formatCents(listing.listCents)}
              </p>
            </div>
            <div className="flex flex-col gap-2">
              {messages.map((message) => (
                <AgentChatBubble key={message.id} from={message.from} text={message.text} cents={message.cents} />
              ))}
            </div>
            <ConvergenceBar
              bidCents={deal.bidCents}
              askCents={deal.askCents}
              listCents={listing.listCents}
              myLimitCents={limits.floorCents}
              role="seller"
            />
            <DealTracker
              status={deal.status}
              offerCents={deal.bidCents}
              askCents={deal.askCents}
              round={deal.round}
            />
            {showDecision && (
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={onAccept}
                  disabled={deal.sellerAccepted}
                  className="h-12 rounded-xl bg-green font-semibold text-white disabled:opacity-40"
                >
                  {deal.sellerAccepted ? 'Accepted' : 'Accept'}
                </button>
                <button type="button" onClick={onDecline} className="h-12 rounded-xl bg-red font-semibold text-white">
                  Decline
                </button>
              </div>
            )}
            {showShip && (
              <div className="flex gap-2">
                <input
                  value={tracking}
                  onChange={(event) => setTracking(event.target.value)}
                  className="h-12 min-w-0 flex-1 rounded-xl border border-slate-300 px-3 outline-none focus:border-amber"
                  placeholder="Tracking number"
                />
                <button
                  type="button"
                  onClick={onShipped}
                  className="h-12 rounded-xl bg-teal px-5 text-sm font-semibold text-white"
                >
                  Shipped
                </button>
              </div>
            )}
            {deal.status === 'shipped' && deal.tracking && (
              <p className="font-mono text-sm text-slate2">Tracking {deal.tracking}</p>
            )}
          </section>
        )}
      </div>
    </main>
  )
}
