import { AgentChatBubble } from '../components/AgentChatBubble'
import { AvaTile } from '../components/AvaTile'
import { CaptionBar } from '../components/CaptionBar'
import { ConvergenceBar } from '../components/ConvergenceBar'
import { DealTracker } from '../components/DealTracker'
import { MoneyFlowStrip } from '../components/MoneyFlowStrip'
import { NessieLogRow } from '../components/NessieLogRow'
import { QrJoinCard } from '../components/QrJoinCard'
import { VaultCard } from '../components/VaultCard'
import { mockAccounts, mockListings, mockMembers, mockMessages, mockNessieLog, type DealStatus } from '../data'
import { formatCents } from '../format'
import { useLive } from '../liveDeal'

const CAPTIONS: Record<DealStatus, string> = {
  negotiating: 'Agents are negotiating inside the vault. Limits stay sealed.',
  agreed: 'Both sides agreed. A human still has to accept before money moves.',
  funding: 'Funds are moving from the buyer into escrow.',
  escrowed: 'The vault is holding the money until delivery is confirmed.',
  shipped: 'It shipped. The buyer confirms delivery, then the seller is paid.',
  releasing: 'Releasing the escrow to the seller.',
  released: 'Paid. The seller has the money.',
  refunding: 'Sending the money back to the buyer.',
  refunded: 'Refunded. The deal is closed.',
  no_deal: 'No deal. The vault stayed shut.',
  declined: 'Declined. Nothing moved.',
}

function moneyStep(status: DealStatus): 1 | 2 | 3 {
  if (status === 'releasing' || status === 'released') return 3
  if (status === 'funding' || status === 'escrowed' || status === 'shipped' || status === 'refunding') return 2
  return 1
}

export function DemoPage() {
  const { deal } = useLive()
  const listing = mockListings.find((item) => item.id === deal.listingId)
  const messages = mockMessages.filter((message) => message.dealId === deal.id)
  const speaking = !['released', 'refunded', 'declined', 'no_deal'].includes(deal.status)
  const heldCents = deal.priceCents ?? deal.askCents

  return (
    <main className="min-h-screen overflow-auto bg-canvas">
      <div className="flex h-[1080px] w-[1920px] flex-col bg-canvas text-ink">
        <header className="flex h-[72px] shrink-0 items-center justify-between px-10">
          <p className="text-sm font-semibold tracking-[0.22em] text-teal">AVAL</p>
          <p className="text-xl font-semibold">
            {listing ? `${listing.emoji} ${listing.title}` : 'Live deal'}
          </p>
          <p className="font-mono text-lg text-slate2">
            {listing ? formatCents(listing.listCents) : ''}
          </p>
        </header>

        <div className="grid min-h-0 flex-1 grid-cols-[320px_1fr_400px] gap-8 px-10 pb-8">
          <aside className="flex flex-col gap-8">
            <AvaTile speaking={speaking} />
            <ul className="flex flex-col gap-3">
              {mockMembers.map((member) => (
                <li key={member.id} className="flex items-center justify-between text-sm">
                  <span>
                    {member.name}
                    <span className="ml-2 text-slate2">
                      {member.slot} · {member.role}
                    </span>
                  </span>
                  <span className={`h-2.5 w-2.5 rounded-full ${member.online ? 'bg-green' : 'bg-slate-500'}`} />
                </li>
              ))}
            </ul>
          </aside>

          <section className="flex min-h-0 flex-col gap-5 overflow-hidden rounded-3xl bg-surface p-6 text-ink">
            <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-auto">
              {messages.map((message) => (
                <AgentChatBubble key={message.id} from={message.from} text={message.text} cents={message.cents} />
              ))}
            </div>
            {listing && (
              <ConvergenceBar
                bidCents={deal.bidCents}
                askCents={deal.askCents}
                listCents={listing.listCents}
                role="buyer"
              />
            )}
            <DealTracker
              status={deal.status}
              offerCents={deal.bidCents}
              askCents={deal.askCents}
              round={deal.round}
            />
            {deal.status === 'escrowed' && <VaultCard priceCents={heldCents} />}
          </section>

          <aside className="flex min-h-0 flex-col gap-6">
            <QrJoinCard />
            <div className="rounded-2xl bg-surface p-5">
              <MoneyFlowStrip step={moneyStep(deal.status)} amountCents={heldCents} />
            </div>
            <div className="rounded-2xl border border-slate-200 bg-surface p-4">
              {mockAccounts.map((account) => (
                <div key={account.slot} className="flex items-center justify-between py-1 font-mono text-sm">
                  <span className="text-slate2">
                    {account.slot} {account.label}
                  </span>
                  <span>{formatCents(account.balanceCents)}</span>
                </div>
              ))}
            </div>
            <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-auto">
              {mockNessieLog.map((log) => (
                <NessieLogRow key={log.id} log={log} />
              ))}
            </div>
          </aside>
        </div>

        <CaptionBar text={CAPTIONS[deal.status]} />
      </div>
    </main>
  )
}
