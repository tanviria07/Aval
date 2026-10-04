import { useEffect, useRef, useState } from 'react'
import QRCode from 'qrcode'
import { AlertTriangle, ShieldCheck } from 'lucide-react'
import {
  demoReset,
  membersOnPayment,
  onAccounts,
  onMembers,
  onNessieLog,
  onPayments,
  seedBank,
  type Member,
  type NessieLog,
  type Payment,
  useRows,
} from '../data'
import { Avatar } from '../components/Avatar'
import { CountdownBar, objectionEndsAt } from '../components/CountdownBar'
import { Logo } from '../components/Logo'
import { Money } from '../components/Money'
import { ReasonList } from '../components/ReasonList'
import { StatusPill } from '../components/StatusPill'
import { formatCents, formatClock } from '../format'

export function DemoPage() {
  const members = useRows(onMembers)
  const payments = useRows(onPayments)
  const logs = useRows(onNessieLog)
  const accounts = useRows(onAccounts)
  const [note, setNote] = useState('')
  const held = [...payments]
    .filter(payment => payment.status === 'held' || payment.status === 'objection')
    .sort((a, b) => (BigInt(a.id) < BigInt(b.id) ? 1 : -1))[0]
  const listed = membersOnPayment(members, held ? [held.elderId] : [])
  const mom =
    listed.find(member => member.role === 'mom') ??
    members.find(member => member.role === 'mom' && member.slot === 'A') ??
    members.find(member => member.role === 'mom' && member.name !== 'Bootstrap')
  const momName = mom?.name ?? 'Mom'
  const connected = members.filter(member => member.online).length
  const momBalance = accounts.find(account => account.slot === 'MARGARET')?.balanceCents
  const holdBalance = accounts.find(account => account.slot === 'ESCROW')?.balanceCents
  const payeeAccount = held ? accounts.find(account => account.label.toLowerCase() === held.payeeName.toLowerCase()) : undefined

  async function run(action: () => Promise<void>) {
    setNote('')
    try {
      await action()
    } catch (err) {
      setNote(err instanceof Error ? err.message : 'That did not go through.')
    }
  }

  return (
    <main className="h-dvh w-screen overflow-hidden bg-ink p-8 text-white">
      <div className="flex h-full min-h-0 flex-col gap-4">
        <header className="flex shrink-0 items-center justify-between">
          <div className="flex items-center gap-5">
            <Logo className="h-8 w-[150px]" />
            <p className="font-serif text-2xl italic text-white/70">Scams need silence.</p>
          </div>
          <p className="flex items-center gap-3 text-lg">
            <span className="pulse-live h-3 w-3 rounded-full bg-home" aria-hidden />
            <span className="uppercase tracking-[0.14em]">Live</span>
            <span> · {connected} connected</span>
          </p>
        </header>

        <div className="grid min-h-0 flex-1 grid-cols-12 gap-4">
          <section className="col-span-3 flex min-h-0 flex-col">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-white/60">Mom's screen</p>
            <div className="mt-3 flex min-h-0 flex-1 items-center justify-center">
              <div className="h-full max-h-[640px] w-full max-w-[320px] rounded-[40px] bg-ink-2 p-[10px]">
                <div className="h-full overflow-hidden rounded-[30px] bg-paper text-ink">
                  <MomMirror name={momName} balance={momBalance} payment={held} family={listed} />
                </div>
              </div>
            </div>
          </section>

          <section className="col-span-6 flex min-h-0 flex-col">
            <Stage payment={held} />
          </section>

          <section className="col-span-3 flex min-h-0 flex-col">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-white/60">Family</p>
            <ul className="mt-4 flex min-h-0 flex-1 flex-col gap-4 overflow-auto">
              {listed.map(member => (
                <FamilyRow key={member.id} member={member} payment={held} />
              ))}
            </ul>
          </section>
        </div>

        <footer className="grid h-[200px] shrink-0 grid-cols-12 gap-4">
          <div className="col-span-5 flex min-w-0 flex-col">
            <div className="grid grid-cols-3 gap-3">
              <BalanceTile label="Mom" cents={momBalance} positive="home" />
              <BalanceTile label="Aval Hold" cents={holdBalance} positive="release" />
              <BalanceTile label={held?.payeeName ?? 'Payee'} cents={payeeAccount?.balanceCents} positive="release" />
            </div>
            <div className="mt-auto flex items-center gap-4 text-sm text-white/30">
              <button type="button" onClick={() => void run(seedBank)}>
                Seed
              </button>
              <button type="button" onClick={() => void run(demoReset)}>
                Reset
              </button>
              {note && <span className="truncate text-white/50">{note}</span>}
            </div>
          </div>
          <Ledger logs={logs} className="col-span-5" />
          <div className="col-span-2">
            <JoinQr name={momName} />
          </div>
        </footer>
      </div>
    </main>
  )
}

function MomMirror({
  name,
  balance,
  payment,
  family,
}: {
  name: string
  balance?: number
  payment?: Payment
  family: Member[]
}) {
  return (
    <div className="flex h-full flex-col overflow-hidden px-4 py-5">
      <p className="font-serif text-xl leading-tight">
        {new Date().getHours() < 12 ? 'Good morning' : new Date().getHours() < 17 ? 'Good afternoon' : 'Good evening'}, {name.split(' ')[0]}
      </p>
      <div className="mt-4 rounded-card bg-white p-4 shadow-vault">
        <p className="text-xs text-muted">Checking</p>
        <p className="mt-1">{balance != null ? <Money cents={balance} size="lg" /> : '—'}</p>
      </div>
      {payment ? (
        <div className="mt-4 flex flex-1 flex-col items-center text-center">
          <span className="flex h-16 w-16 items-center justify-center rounded-full bg-held-bg text-held">
            <ShieldCheck size={28} strokeWidth={1.75} aria-hidden />
          </span>
          <p className="mt-3 font-serif text-lg leading-tight">Held safely at your bank</p>
          <p className="mt-2 text-sm">Your family is looking at it with you.</p>
          <p className="mt-3 text-sm text-muted">{payment.payeeName}</p>
          <Money cents={payment.amountCents} size="md" />
          <div className="mt-4 flex justify-center gap-2">
            {family.slice(0, 4).map(member => (
              <Avatar key={member.id} name={member.name} online={member.online} size={32} />
            ))}
          </div>
        </div>
      ) : (
        <p className="mt-6 text-sm text-muted">No payment is waiting.</p>
      )}
    </div>
  )
}

function Stage({ payment }: { payment?: Payment }) {
  const [endsAt, setEndsAt] = useState<number | null>(null)
  const releasing = payment?.status === 'objection'
  useEffect(() => {
    if (!payment || !releasing) {
      setEndsAt(null)
      return
    }
    setEndsAt(objectionEndsAt(payment.id, true))
  }, [payment?.id, releasing])

  if (!payment) {
    return (
      <div className="flex h-full items-center justify-center rounded-card bg-ink-2">
        <p className="font-serif text-4xl text-white/40">Waiting for a payment…</p>
      </div>
    )
  }

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden rounded-card bg-ink-2">
      {payment.secretFlag && (
        <div className="flex items-center gap-3 bg-alert px-6 py-4 text-white">
          <AlertTriangle size={28} strokeWidth={1.75} aria-hidden />
          <div>
            <p className="text-xl font-semibold">Mom says someone told her to keep this secret. Call her now.</p>
            <p className="text-base text-white/80">Her approval does not count.</p>
          </div>
        </div>
      )}
      <div className="flex min-h-0 flex-1 flex-col justify-center px-10 py-6">
        <StatusPill status={payment.status} className="w-fit text-[18px]" />
        <p className="mt-4">
          <Money cents={payment.amountCents} size="hero" className="text-white" />
        </p>
        <p className="mt-3 text-[28px] text-white/80">to {payment.payeeName}</p>
        <div className="mt-6 max-w-xl">
          <ReasonList reasonsJson={payment.reasonsJson} tone="light" />
        </div>
        {releasing && endsAt != null && <CountdownBar endsAt={endsAt} large surface="dark" className="mt-8 max-w-xl" />}
      </div>
    </div>
  )
}

function FamilyRow({ member, payment }: { member: Member; payment?: Payment }) {
  const action = latestAction(member, payment)
  return (
    <li className={`flex items-center gap-4 ${member.online ? '' : 'opacity-40'}`}>
      <Avatar name={member.name} online={member.online} size={40} />
      <span className="min-w-0 flex-1 truncate text-[22px]">{member.name}</span>
      <span className={`shrink-0 rounded-full px-3 py-1 text-sm font-medium ${action.className}`}>{action.label}</span>
    </li>
  )
}

function latestAction(member: Member, payment?: Payment) {
  const waiting = { label: 'Waiting', className: 'bg-white/10 text-white/70' }
  if (!payment) return waiting
  const stops = (payment.stoppedBy ?? '').split(',').filter(Boolean)
  if (stops.includes(member.id)) return { label: 'Stopped', className: 'bg-alert-bg text-alert' }
  if (payment.pausedBy === member.id) return { label: 'Paused', className: 'bg-held-bg text-held' }
  if (payment.paidBy === member.id) return { label: 'Confirmed', className: 'bg-release-bg text-release' }
  return waiting
}

function useDelta(cents?: number) {
  const previous = useRef<number | undefined>(undefined)
  const [delta, setDelta] = useState<number | null>(null)
  useEffect(() => {
    if (cents == null) return
    if (previous.current != null && previous.current !== cents) {
      const next = cents - previous.current
      setDelta(next)
      const timer = window.setTimeout(() => setDelta(null), 1500)
      previous.current = cents
      return () => window.clearTimeout(timer)
    }
    previous.current = cents
  }, [cents])
  return delta
}

function BalanceTile({ label, cents, positive }: { label: string; cents?: number; positive: 'home' | 'release' }) {
  const delta = useDelta(cents)
  return (
    <div className="min-w-0">
      <p className="truncate text-sm text-white/60">{label}</p>
      <div className="mt-2">{cents != null ? <Money cents={cents} size="tile" className="text-white" /> : <span className="text-white/40">—</span>}</div>
      {delta != null && delta !== 0 && (
        <p className={`mt-1 text-lg tabular-nums ${delta < 0 ? 'text-held-bg' : positive === 'home' ? 'text-home-bg' : 'text-release-bg'}`}>
          {delta > 0 ? '+' : '−'}
          {formatCents(Math.abs(delta))}
        </p>
      )}
    </div>
  )
}

function Ledger({ logs, className = '' }: { logs: NessieLog[]; className?: string }) {
  const rows = [...logs]
    .filter(log => log.method === 'POST' && log.path.includes('/transfers'))
    .sort((a, b) => (BigInt(a.id) < BigInt(b.id) ? 1 : -1))
  const seen = useRef(new Set<string>())
  const ready = useRef(false)
  const [fresh, setFresh] = useState<string[]>([])

  useEffect(() => {
    if (!ready.current) {
      if (rows.length === 0) return
      rows.forEach(row => seen.current.add(row.id))
      ready.current = true
      return
    }
    const newcomers = rows.filter(row => !seen.current.has(row.id)).map(row => row.id)
    newcomers.forEach(id => seen.current.add(id))
    if (newcomers.length === 0) return
    setFresh(newcomers)
    const timer = window.setTimeout(() => setFresh([]), 1000)
    return () => window.clearTimeout(timer)
  }, [logs])

  return (
    <div className={`min-h-0 overflow-auto font-mono text-[16px] leading-7 ${className}`}>
      {rows.map(row => (
        <LedgerLine key={row.id} log={row} fresh={fresh.includes(row.id)} />
      ))}
    </div>
  )
}

function LedgerLine({ log, fresh }: { log: NessieLog; fresh: boolean }) {
  const match = /^(direct|hold|release|refund)/i.exec(log.note.trim())
  const kind = (match?.[1] ?? 'failed').toUpperCase()
  const amount = /\$([0-9,.]+)/.exec(log.note)?.[1]
  const dollars = amount ? Number(amount.replace(/,/g, '')) : null
  const route =
    kind === 'HOLD'
      ? 'Margaret → Aval Hold'
      : kind === 'RELEASE'
        ? 'Aval Hold → payee'
        : kind === 'REFUND'
          ? 'Aval Hold → Margaret'
          : kind === 'DIRECT'
            ? 'Margaret → payee'
            : 'Needs attention'
  const color =
    kind === 'HOLD' ? 'text-held-bg' : kind === 'RELEASE' ? 'text-release-bg' : kind === 'REFUND' ? 'text-home-bg' : kind === 'DIRECT' ? 'text-white/70' : 'text-alert-bg'
  return (
    <p className={`grid grid-cols-[92px_88px_120px_1fr_48px] gap-3 ${fresh ? 'ledger-fresh' : ''} ${color}`}>
      <span className="text-white/70">{formatClock(log.at)}</span>
      <span>{kind}</span>
      <span className="tabular-nums text-white">{dollars != null && Number.isFinite(dollars) ? formatCents(Math.round(dollars * 100)) : '—'}</span>
      <span className="truncate text-white/80">{route}</span>
      <span className="text-white/60">{log.status}</span>
    </p>
  )
}

function JoinQr({ name }: { name: string }) {
  const [svg, setSvg] = useState('')
  useEffect(() => {
    const url = `${window.location.origin}/join`
    QRCode.toString(url, { type: 'svg', margin: 0, color: { dark: '#0E1424', light: '#FFFFFF' } })
      .then(setSvg)
      .catch(() => setSvg(''))
  }, [])
  return (
    <div className="flex h-full flex-col items-center justify-center rounded-card bg-white px-3 py-3 text-ink">
      <div className="h-[140px] w-[140px] [&_svg]:h-full [&_svg]:w-full" dangerouslySetInnerHTML={{ __html: svg }} />
      <p className="mt-2 text-center text-sm leading-tight">Scan to join {name}'s family</p>
    </div>
  )
}
