import { useEffect, useRef, useState } from 'react'
import QRCode from 'qrcode'
import { Star } from 'lucide-react'
import {
  demoReset,
  listedFamily,
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
import { CountdownBar, objectionEndsAt } from '../components/CountdownBar'
import { Logo } from '../components/Logo'
import { Money } from '../components/Money'
import { ReasonList } from '../components/ReasonList'
import { Stamp, StatusPill } from '../components/StatusPill'
import { TicketStub } from '../components/TicketStub'
import { WashiTape } from '../components/WashiTape'
import { formatCents, formatClock } from '../format'

function useStageScale() {
  const [scale, setScale] = useState(1)
  useEffect(() => {
    const fit = () => setScale(Math.min(window.innerWidth / 1920, window.innerHeight / 1080))
    fit()
    window.addEventListener('resize', fit)
    return () => window.removeEventListener('resize', fit)
  }, [])
  return scale
}

export function DemoPage() {
  const scale = useStageScale()
  const members = useRows(onMembers)
  const payments = useRows(onPayments)
  const logs = useRows(onNessieLog)
  const accounts = useRows(onAccounts)
  const [note, setNote] = useState('')
  const held = [...payments]
    .filter(payment => payment.status === 'held' || payment.status === 'objection')
    .sort((a, b) => (BigInt(a.id) < BigInt(b.id) ? 1 : -1))[0]
  const listed = listedFamily(members, held)
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
    <div className="flex h-dvh w-screen items-center justify-center overflow-hidden bg-demo">
    <main
      className="h-[1080px] w-[1920px] shrink-0 overflow-hidden bg-demo p-8 text-paper"
      style={{ transform: `scale(${scale})` }}
    >
      <div className="flex h-full min-h-0 flex-col gap-4">
        <header className="flex shrink-0 items-end justify-between gap-6 border-b border-paper/30 pb-3">
          <div className="min-w-0">
            <div className="flex items-center gap-4">
              <Logo className="h-7 w-[128px]" color="#F4ECDD" />
              <h1 className="truncate font-serif text-4xl uppercase tracking-wide">The Family Ledger</h1>
            </div>
            <p className="mt-1 font-type text-[22px] text-paper/80">Scams need silence. — Live edition</p>
          </div>
          <Stamp label={`Live · ${connected} connected`} tone="red" className="shrink-0 !text-[18px]" />
        </header>

        <div className="grid min-h-0 flex-1 grid-cols-12 gap-4">
          <section className="col-span-3 flex min-h-0 flex-col">
            <div className="flex min-h-0 flex-1 items-center justify-center">
              <div className="flex h-full max-h-[620px] w-full max-w-[300px] flex-col bg-white px-3 pb-8 pt-3 shadow-scrap">
                <div className="ruled min-h-0 flex-1 overflow-hidden bg-paper text-ink">
                  <MomMirror name={momName} balance={momBalance} payment={held} />
                </div>
                <p className="mt-2 text-center font-script text-2xl leading-none text-ink">Mom's screen</p>
              </div>
            </div>
          </section>

          <section className="col-span-6 flex min-h-0 flex-col">
            <Stage payment={held} />
          </section>

          <section className="col-span-3 flex min-h-0 flex-col">
            <p className="font-type text-[18px] uppercase tracking-[0.16em] text-paper/70">Family</p>
            <ul className="mt-3 flex min-h-0 flex-1 flex-col gap-3 overflow-auto pr-1">
              {listed.map(member => (
                <FamilyRow key={member.id} member={member} payment={held} />
              ))}
            </ul>
          </section>
        </div>

        <footer className="flex shrink-0 flex-col gap-3">
          <div className="grid grid-cols-12 gap-4">
            <div className="col-span-8 flex min-w-0 flex-col">
              <div className="grid grid-cols-3 gap-3">
                <BalanceTile label="Mom" cents={momBalance} positive="sage" />
                <BalanceTile label="Aval Hold" cents={holdBalance} positive="blue" />
                <BalanceTile label={held?.payeeName ?? 'Payee'} cents={payeeAccount?.balanceCents} positive="blue" />
              </div>
              <div className="mt-2 flex items-center gap-4 font-type text-sm text-paper">
                <button type="button" onClick={() => void run(seedBank)}>
                  Seed
                </button>
                <button type="button" onClick={() => void run(demoReset)}>
                  Reset
                </button>
                {note && <span className="truncate text-paper/80">{note}</span>}
              </div>
            </div>
            <div className="col-span-4 min-w-0">
              <JoinQr name={momName} />
            </div>
          </div>
          <Ledger logs={logs} />
        </footer>
      </div>
    </main>
    </div>
  )
}

function MomMirror({ name, balance, payment }: { name: string; balance?: number; payment?: Payment }) {
  const hour = new Date().getHours()
  const hello = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening'
  return (
    <div className="flex h-full flex-col overflow-hidden px-4 py-5">
      <p className="font-serif text-xl leading-tight">
        {hello}, {name.split(' ')[0]}
      </p>
      <div className="mt-4 bg-paper-2 p-4 shadow-scrap">
        <p className="font-type text-[18px] text-sepia">Checking</p>
        <p className="mt-1">{balance != null ? <Money cents={balance} size="lg" /> : '—'}</p>
      </div>
      {payment ? (
        <div className="mt-4 flex flex-1 flex-col items-center text-center">
          <StatusPill status={payment.status} className="!text-[18px]" />
          <p className="mt-4 font-serif text-[18px] leading-tight">Held safely at your bank</p>
          <p className="mt-2 font-sans text-[18px]">Your family is looking at it with you.</p>
          <p className="mt-3 font-sans text-[18px] text-sepia">{payment.payeeName}</p>
          <Money cents={payment.amountCents} size="md" />
        </div>
      ) : (
        <p className="mt-6 font-sans text-[18px] text-sepia">No payment is waiting.</p>
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
      <div className="flex h-full items-center justify-center bg-paper-2 text-ink shadow-scrap">
        <p className="font-serif text-4xl text-sepia">Waiting for a payment…</p>
      </div>
    )
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      {payment.secretFlag && (
        <div className="gingham mb-3 p-2">
          <div className="flex items-center gap-3 bg-paper px-5 py-3 text-ink">
            <Star className="shrink-0 text-stamp" size={26} strokeWidth={1.75} aria-hidden />
            <div>
              <p className="font-sans text-xl font-semibold">Mom says someone told her to keep this secret. Call her now.</p>
              <p className="font-sans text-base text-sepia">Her approval does not count.</p>
            </div>
          </div>
        </div>
      )}
      <TicketStub id={payment.id} punch="#2A211C" className="flex min-h-0 flex-1 flex-col justify-center">
        <div className="mt-3">
          <StatusPill status={payment.status} className="text-lg" />
        </div>
        <p className="mt-4">
          <Money cents={payment.amountCents} size="hero" />
        </p>
        <p className="mt-3 font-sans text-[28px]">to {payment.payeeName}</p>
        <div className="mt-5 max-w-xl">
          <ReasonList reasonsJson={payment.reasonsJson} />
        </div>
        {releasing && endsAt != null && <CountdownBar endsAt={endsAt} large className="mt-6 max-w-xl" />}
      </TicketStub>
    </div>
  )
}

const polaroidTones = ['#E4D3C4', '#D9C7B0', '#E7D5D2', '#D5D0C4', '#E2D4C2']

function toneFor(name: string) {
  let hash = 0
  for (const char of name) hash = (hash * 31 + char.charCodeAt(0)) >>> 0
  return polaroidTones[hash % polaroidTones.length]
}

function FamilyRow({ member, payment }: { member: Member; payment?: Payment }) {
  const action = latestAction(member, payment)
  const initial = member.name.trim().charAt(0).toUpperCase() || '?'
  const first = member.name.trim().split(' ')[0] || member.name
  return (
    <li className="flex items-center gap-4">
      <figure className="relative w-[147px] shrink-0 bg-white px-3 pb-2 pt-3 shadow-scrap">
        <WashiTape className="-top-2 left-2 w-20" />
        <div
          className="relative flex aspect-square items-center justify-center font-serif text-4xl text-ink"
          style={{ background: toneFor(member.name) }}
        >
          {initial}
          {member.online && <span className="absolute bottom-1.5 right-1.5 h-3.5 w-3.5 rounded-full bg-sage-ink" aria-label="Online" />}
        </div>
        <figcaption className="mt-1 truncate text-center font-script text-[26px] leading-none text-ink">{first}</figcaption>
        <p className="text-center font-sans text-[18px] leading-none text-sepia">{member.online ? 'online' : 'offline'}</p>
      </figure>
      <Stamp label={action.label} tone={action.tone} className="!text-[18px]" />
    </li>
  )
}

function latestAction(member: Member, payment?: Payment): { label: string; tone: 'red' | 'mustard' | 'sage' | 'sepia' } {
  const waiting = { label: 'Waiting', tone: 'sepia' as const }
  if (!payment) return waiting
  const stops = (payment.stoppedBy ?? '').split(',').filter(Boolean)
  if (stops.includes(member.id)) return { label: 'Stopped', tone: 'red' }
  if (payment.pausedBy === member.id) return { label: 'Paused', tone: 'mustard' }
  if (payment.approvedBy === member.id || payment.paidBy === member.id) return { label: 'Approved', tone: 'sage' }
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

function BalanceTile({ label, cents, positive }: { label: string; cents?: number; positive: 'sage' | 'blue' }) {
  const delta = useDelta(cents)
  return (
    <div className="relative min-w-0 bg-paper px-2 pb-3 pt-5 text-ink">
      <WashiTape className="-top-2 left-2 w-12" />
      <p className="truncate font-type text-[18px] uppercase text-sepia">{label}</p>
      <div className="mt-1">{cents != null ? <Money cents={cents} size="lg" className="!text-[48px] !leading-none" /> : <span className="font-sans text-[48px] leading-none text-sepia">—</span>}</div>
      {delta != null && delta !== 0 && (
        <p className={`mt-1 font-sans text-sm tabular-nums ${delta < 0 ? 'text-stamp' : positive === 'sage' ? 'text-sage-ink' : 'text-blue'}`}>
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
    .slice(0, 6)
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
    <div className={`h-[240px] overflow-hidden bg-paper px-3 font-type text-[22px] text-ink ${className}`}>
      {rows.map(row => (
        <LedgerLine key={row.id} log={row} fresh={fresh.includes(row.id)} />
      ))}
    </div>
  )
}

function shortTransferId(id?: string) {
  if (!id || id.length < 8) return '—'
  return `${id.slice(0, 4)}…${id.slice(-4)}`
}

function kindOf(log: NessieLog) {
  return (/^(direct|hold|release|refund)/i.exec(log.note.trim())?.[1] ?? 'failed').toUpperCase()
}

function centsOf(log: NessieLog) {
  const amount = /\$([0-9,.]+)/.exec(log.note)?.[1]
  if (!amount) return null
  const dollars = Number(amount.replace(/,/g, ''))
  return Number.isFinite(dollars) ? Math.round(dollars * 100) : null
}

function noteTransferId(note: string) {
  const marker = ' · id '
  const at = note.lastIndexOf(marker)
  if (at < 0) return '—'
  return shortTransferId(note.slice(at + marker.length).trim())
}

function LedgerLine({ log, fresh }: { log: NessieLog; fresh: boolean }) {
  const kind = kindOf(log)
  const cents = centsOf(log)
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
    kind === 'HOLD' ? 'text-stamp' : kind === 'RELEASE' ? 'text-blue' : kind === 'REFUND' ? 'text-sage-ink' : kind === 'DIRECT' ? 'text-sepia' : 'text-stamp'
  return (
    <p className={`grid h-10 grid-cols-[150px_120px_180px_1fr_72px_150px] items-center gap-3 border-b border-dotted border-sepia/40 leading-10 ${fresh ? 'ledger-fresh' : ''}`}>
      <span className="text-sepia">{formatClock(log.at)}</span>
      <span className={color}>{kind}</span>
      <span className="tabular-nums">{cents != null ? formatCents(cents) : '—'}</span>
      <span className="truncate">{route}</span>
      <span className="text-sepia">{log.status}</span>
      <span className="text-sepia">{noteTransferId(log.note)}</span>
    </p>
  )
}

function JoinQr({ name }: { name: string }) {
  const [svg, setSvg] = useState('')
  useEffect(() => {
    const url = `${window.location.origin}/join`
    QRCode.toString(url, { type: 'svg', margin: 0, color: { dark: '#2E241F', light: '#F4ECDD' } })
      .then(setSvg)
      .catch(() => setSvg(''))
  }, [])
  return (
    <div className="relative flex h-full flex-col items-center justify-center bg-paper px-3 py-3 text-ink">
      <span className="stamp absolute right-2 top-2 border-stamp font-type text-[10px] uppercase text-stamp">Aval</span>
      <div className="h-[120px] w-[120px] [&_svg]:h-full [&_svg]:w-full" dangerouslySetInnerHTML={{ __html: svg }} />
      <p className="mt-2 text-center font-sans text-sm leading-tight">Scan to join {name}'s family</p>
    </div>
  )
}
