import { useState } from 'react'
import { currentIdentity, onMembers, onPayments, pausePayment, releasePayment, stopPayment, useRows, type Payment } from '../data'
import { formatCents } from '../format'
import { ReasonList } from '../components/ReasonList'

export function GuardianPage() {
  const held = useRows(onPayments).filter(payment => payment.status === 'held' || payment.status === 'objection')
  const members = useRows(onMembers)
  const me = members.find(member => member.id === currentIdentity())

  return (
    <main className="min-h-screen bg-canvas px-4 py-8 text-ink">
      <div className="mx-auto flex max-w-lg flex-col gap-6">
        <header>
          <p className="text-sm font-semibold tracking-[0.2em] text-teal">AVAL</p>
          <h1 className="mt-1 text-3xl font-semibold">Guardians</h1>
          {me && (
            <p className="mt-1 text-sm text-slate2">
              {me.name} · {me.role} · {me.online ? 'online' : 'offline'}
            </p>
          )}
        </header>
        <ul className="flex flex-col gap-1 text-sm text-slate2">
          {members.map(member => (
            <li key={member.id}>
              {member.name} · {member.role} · {member.online ? 'online' : 'offline'}
            </li>
          ))}
        </ul>
        {held.length === 0 && <p className="text-sm text-slate2">No held payments.</p>}
        {held.map(payment => (
          <HeldCard key={payment.id} payment={payment} />
        ))}
      </div>
    </main>
  )
}

function HeldCard({ payment }: { payment: Payment }) {
  const [error, setError] = useState('')

  async function approve() {
    setError('')
    try {
      await releasePayment(payment.id)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Someone already acted')
    }
  }

  return (
    <article className="rounded-2xl bg-surface p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">{payment.payeeName}</h2>
          <p className="font-mono text-sm text-slate2">{formatCents(payment.amountCents)}</p>
        </div>
        <p className="font-mono text-sm">Score {payment.score}</p>
      </div>
      <ReasonList reasonsJson={payment.reasonsJson} />
      {payment.stoppedBy && <p className="mt-2 text-xs text-slate2">Stop votes: {payment.stoppedBy}</p>}
      <div className="mt-4 grid grid-cols-3 gap-2">
        <button type="button" onClick={() => void pausePayment(payment.id)} className="h-10 rounded-xl bg-amber text-sm font-semibold text-ink">
          Pause
        </button>
        <button type="button" onClick={() => void stopPayment(payment.id)} className="h-10 rounded-xl bg-red text-sm font-semibold text-white">
          Stop
        </button>
        <button
          type="button"
          onClick={() => void approve()}
          className="h-10 rounded-xl bg-teal text-sm font-semibold text-white"
        >
          Approve
        </button>
      </div>
      {error && <p className="mt-2 text-sm text-red">{error}</p>}
    </article>
  )
}
