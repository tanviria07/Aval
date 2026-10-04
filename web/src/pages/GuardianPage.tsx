import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Check, Pause, Star, X } from 'lucide-react'
import {
  listedFamily,
  onMembers,
  plainMessage,
  onPayments,
  pausePayment,
  releasePayment,
  stopPayment,
  type Member,
  type Payment,
  useRows,
} from '../data'
import { Button } from '../components/Button'
import { CountdownBar, objectionEndsAt } from '../components/CountdownBar'
import { Logo } from '../components/Logo'
import { Money } from '../components/Money'
import { Polaroid } from '../components/Polaroid'
import { ReasonList } from '../components/ReasonList'
import { StatusPill } from '../components/StatusPill'
import { TicketStub } from '../components/TicketStub'
import { relativeTime } from '../format'

export function GuardianPage() {
  const payments = useRows(onPayments)
  const members = useRows(onMembers)
  const held = payments
    .filter(payment => payment.status === 'held' || payment.status === 'objection')
    .sort((a, b) => (BigInt(a.id) < BigInt(b.id) ? 1 : -1))
  const current = held[0]
  const listed = listedFamily(members, current)
  const mom =
    listed.find(member => member.role === 'mom') ??
    members.find(member => member.role === 'mom' && member.slot === 'A') ??
    members.find(member => member.role === 'mom' && member.name !== 'Bootstrap')
  const momName = mom?.name ?? 'Mom'

  return (
    <main className="min-h-screen overflow-x-hidden bg-paper text-ink">
      <div className="mx-auto flex min-h-screen w-full max-w-[480px] flex-col px-5 pb-28 pt-8">
        <Logo className="h-6 w-[112px]" />
        <header className="mt-6">
          <h1 className="font-serif text-2xl">{momName}'s family</h1>
          <ul className="mt-4 flex flex-wrap gap-3">
            {listed.map(member => (
              <li key={member.id}>
                <Polaroid name={member.name} online={member.online} />
              </li>
            ))}
          </ul>
        </header>
        {!current && <Idle momName={momName} />}
        {current && <AlertCard payment={current} members={members} momName={momName} />}
        {held.slice(1).map(payment => (
          <div key={payment.id} className="mt-4">
            <AlertCard payment={payment} members={members} momName={momName} />
            <ActionBar payment={payment} />
          </div>
        ))}
        <p className="mt-auto pt-8 text-center">
          <Link to="/join?switch=1" className="font-sans text-sm text-sepia">
            Not you? Switch
          </Link>
        </p>
      </div>
      {current && <ActionBar payment={current} dock />}
    </main>
  )
}

function Idle({ momName }: { momName: string }) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center px-6 py-16 text-center">
      <p className="font-sans text-xl">Everything looks normal.</p>
      <p className="mt-2 font-script text-2xl text-sepia">nothing pinned today</p>
      <p className="mt-3 font-sans text-base text-sepia">You'll only see a payment here if {momName}'s bank holds it.</p>
    </div>
  )
}

function AlertCard({ payment, members, momName }: { payment: Payment; members: Member[]; momName: string }) {
  const [endsAt, setEndsAt] = useState<number | null>(null)
  const releasing = payment.status === 'objection'
  useEffect(() => {
    setEndsAt(releasing ? objectionEndsAt(payment.id, true) : null)
  }, [payment.id, releasing])

  return (
    <div className="mt-6">
      {payment.secretFlag && (
        <div className="gingham mb-3 p-2">
          <div className="flex gap-3 bg-paper-2 p-4 text-ink">
            <Star className="mt-0.5 shrink-0 text-stamp" size={22} strokeWidth={1.75} aria-hidden />
            <div>
              <p className="font-sans font-semibold">Mom says someone told her to keep this secret. Call her now.</p>
              <p className="mt-1 font-sans text-sm text-sepia">Her approval does not count.</p>
            </div>
          </div>
        </div>
      )}
      <TicketStub id={payment.id}>
        <div className="mt-4">
          <StatusPill status={payment.status} className="text-sm" />
        </div>
        <p className="mt-4">
          <Money cents={payment.amountCents} size="xl" />
        </p>
        <p className="mt-2 font-sans text-[20px]">to {payment.payeeName}</p>
        <p className={`mt-4 inline-flex font-type text-sm ${payment.score >= 80 ? 'text-stamp' : 'text-mustard-ink'}`}>
          Risk {payment.score}
        </p>
        <div className="mt-4">
          <ReasonList reasonsJson={payment.reasonsJson} />
        </div>
        {releasing && endsAt != null && <CountdownBar endsAt={endsAt} className="mt-5" />}
        <div className="my-5 border-t border-dotted border-sepia/50" />
        <Timeline payment={payment} members={members} momName={momName} />
      </TicketStub>
    </div>
  )
}

function nameOf(members: Member[], id?: string) {
  if (!id) return 'Someone'
  return members.find(member => member.id === id)?.name ?? 'Someone'
}

function stamp(key: string, fallback: number) {
  const saved = Number(sessionStorage.getItem(key))
  if (Number.isFinite(saved) && saved > 0) return saved
  const at = fallback || Date.now() * 1000
  sessionStorage.setItem(key, String(at))
  return at
}

function Timeline({ payment, members, momName }: { payment: Payment; members: Member[]; momName: string }) {
  const events: { label: string; at: number }[] = [
    { label: `${momName} wants to send`, at: payment.createdAt },
  ]
  if (payment.secretFlag) {
    events.push({ label: `${momName} kept it secret`, at: stamp(`secret-${payment.id}`, payment.createdAt) })
  } else if (payment.paidBy) {
    events.push({ label: `${nameOf(members, payment.paidBy)} confirmed`, at: stamp(`paid-${payment.id}`, payment.createdAt) })
  }
  if (payment.status === 'objection' || payment.status === 'releasing' || payment.status === 'released') {
    events.push({ label: 'A guardian approved', at: stamp(`approved-${payment.id}`, payment.createdAt) })
  }
  if (payment.pausedBy) {
    events.push({ label: `${nameOf(members, payment.pausedBy)} paused`, at: stamp(`paused-${payment.id}`, payment.createdAt) })
  }
  for (const id of (payment.stoppedBy ?? '').split(',').filter(Boolean)) {
    events.push({ label: `${nameOf(members, id)} stopped`, at: stamp(`stop-${payment.id}-${id}`, payment.createdAt) })
  }

  return (
    <ol className="flex flex-col gap-3">
      {events.map(event => (
        <li key={event.label} className="flex items-start gap-3 font-sans text-sm">
          <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-sepia" aria-hidden />
          <span className="min-w-0 flex-1">{event.label}</span>
          <span className="shrink-0 font-type text-sepia">{relativeTime(event.at)}</span>
        </li>
      ))}
    </ol>
  )
}

function ActionBar({ payment, dock = false }: { payment: Payment; dock?: boolean }) {
  const [pending, setPending] = useState('')
  const [error, setError] = useState('')
  const windowOpen = payment.status === 'objection'

  async function run(name: string, action: () => Promise<void>) {
    setError('')
    setPending(name)
    try {
      await action()
    } catch (err) {
      setError(plainMessage(err, 'Someone already acted'))
    } finally {
      setPending('')
    }
  }

  return (
    <div className={dock ? 'fixed inset-x-0 bottom-0 z-10 border-t border-line bg-paper' : 'mt-3'}>
      <div className="mx-auto w-full max-w-[480px] px-5 py-3">
        {error && <p className="mb-2 text-center font-sans text-sm text-stamp">{error}</p>}
        <div className="grid grid-cols-3 gap-2">
          <Button
            variant="quiet"
            pending={pending === 'pause'}
            disabled={Boolean(pending)}
            className={windowOpen ? 'ring-2 ring-mustard' : ''}
            onClick={() => void run('pause', () => pausePayment(payment.id))}
          >
            <Pause size={18} strokeWidth={1.75} aria-hidden />
            Pause
          </Button>
          <Button
            variant="approve"
            pending={pending === 'approve'}
            disabled={Boolean(pending) || windowOpen}
            onClick={() => void run('approve', () => releasePayment(payment.id))}
          >
            <Check size={18} strokeWidth={1.75} aria-hidden />
            Approve
          </Button>
          <Button
            variant="stop"
            pending={pending === 'stop'}
            disabled={Boolean(pending)}
            onClick={() => void run('stop', () => stopPayment(payment.id))}
          >
            <X size={18} strokeWidth={1.75} aria-hidden />
            Stop
          </Button>
        </div>
      </div>
    </div>
  )
}
