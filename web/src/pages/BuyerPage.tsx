import { useState } from 'react'
import { AgentChatBubble } from '../components/AgentChatBubble'
import { ConvergenceBar } from '../components/ConvergenceBar'
import { DealTracker } from '../components/DealTracker'
import { ListingCard } from '../components/ListingCard'
import { SealedLimitInput } from '../components/SealedLimitInput'
import { VaultCard } from '../components/VaultCard'
import { accept, decline, confirmDelivery, mockListings, mockMessages, startDeal, type Listing } from '../data'
import { dollarsToCents, formatCents } from '../format'
import { enterBuyerDeal, updateLive, useLive } from '../liveDeal'

export function BuyerPage() {
  const { deal, limits, buyerInDeal } = useLive()
  const listing = mockListings.find((item) => item.id === deal.listingId)
  const messages = mockMessages.filter((message) => message.dealId === deal.id)
  const [pending, setPending] = useState<Listing | null>(null)
  const [ceiling, setCeiling] = useState('')

  const showDecision = deal.status === 'negotiating' || deal.status === 'agreed' || deal.status === 'funding'
  const heldCents = deal.priceCents ?? deal.askCents

  function submitCeiling() {
    if (!pending) return
    const ceilingCents = dollarsToCents(ceiling)
    if (ceilingCents == null) return
    startDeal(pending.id, ceilingCents)
    enterBuyerDeal(ceilingCents)
    setPending(null)
  }

  function onAccept() {
    accept(deal.id)
    const buyerAccepted = true
    const both = buyerAccepted && deal.sellerAccepted
    updateLive({
      buyerAccepted,
      status: both ? 'escrowed' : deal.status,
      priceCents: both ? deal.askCents : deal.priceCents,
    })
  }

  function onDecline() {
    decline(deal.id)
    updateLive({ status: 'declined', buyerAccepted: false })
  }

  function onGotIt() {
    confirmDelivery(deal.id)
    updateLive({ status: 'released' })
  }

  return (
    <main className="min-h-screen bg-canvas px-4 py-8 text-ink">
      <div className="mx-auto flex max-w-lg flex-col gap-6">
        <header>
          <p className="text-sm font-semibold tracking-[0.2em] text-teal">AVAL</p>
          <h1 className="mt-1 text-3xl font-semibold">Buyer</h1>
        </header>

        <section>
          <h2 className="text-lg font-semibold">Listings</h2>
          <div className="mt-3 grid gap-3">
            {mockListings.map((item) => (
              <ListingCard key={item.id} listing={item} onNegotiate={() => setPending(item)} />
            ))}
          </div>
        </section>

        {buyerInDeal && listing && (
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
              myLimitCents={limits.ceilingCents}
              role="buyer"
            />
            <DealTracker
              status={deal.status}
              offerCents={deal.bidCents}
              askCents={deal.askCents}
              round={deal.round}
            />
            {deal.status === 'escrowed' && <VaultCard priceCents={heldCents} />}
            {showDecision && (
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={onAccept}
                  disabled={deal.buyerAccepted}
                  className="h-12 rounded-xl bg-green font-semibold text-white disabled:opacity-40"
                >
                  {deal.buyerAccepted ? 'Accepted' : 'Accept'}
                </button>
                <button type="button" onClick={onDecline} className="h-12 rounded-xl bg-red font-semibold text-white">
                  Decline
                </button>
              </div>
            )}
            {deal.status === 'shipped' && (
              <button type="button" onClick={onGotIt} className="h-12 rounded-xl bg-green font-semibold text-white">
                Got it
              </button>
            )}
          </section>
        )}
      </div>

      {pending && (
        <div className="fixed inset-0 z-20 flex items-center justify-center bg-ink/70 px-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 text-ink">
            <h2 className="text-xl font-semibold">Sealed ceiling</h2>
            <p className="mt-1 text-sm text-slate2">
              {pending.emoji} {pending.title}
            </p>
            <div className="mt-4">
              <SealedLimitInput label="Ceiling" value={ceiling} onChange={setCeiling} />
            </div>
            <button
              type="button"
              onClick={submitCeiling}
              className="mt-4 h-12 w-full rounded-xl bg-teal text-sm font-semibold text-white"
            >
              Submit
            </button>
          </div>
        </div>
      )}
    </main>
  )
}
