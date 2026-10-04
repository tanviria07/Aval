import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { Check, CheckCircle, House, Shield } from 'lucide-react'
import {
  cancelPayment,
  computeRiskScore,
  confirmPayment,
  currentIdentity,
  fetchMomAccount,
  membersOnPayment,
  onAccounts,
  onMembers,
  onPayments,
  requestPayment,
  type MomAccount,
  type Payment,
  type PaymentStatus,
  useRows,
} from '../data'
import { Avatar } from '../components/Avatar'
import { Button } from '../components/Button'
import { Logo } from '../components/Logo'
import { Money } from '../components/Money'
import { PaperCard } from '../components/PaperCard'
import { Polaroid } from '../components/Polaroid'
import { StatusPill } from '../components/StatusPill'
import { WashiTape } from '../components/WashiTape'
import { dollarsToCents } from '../format'

type View = 'home' | 'send' | 'secrecy' | 'result'

const activeStatuses: PaymentStatus[] = ['holding', 'held', 'objection', 'releasing', 'refunding']
const resultStatuses: PaymentStatus[] = ['released', 'refunded', 'failed', 'sent']

function greeting(name: string) {
  const hour = new Date().getHours()
  const part = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening'
  return `${part}, ${name}`
}

function answered(payment: Payment) {
  return payment.secretFlag || Boolean(payment.paidBy)
}

export function MomPage() {
  const payments = useRows(onPayments)
  const accounts = useRows(onAccounts)
  const members = useRows(onMembers)
  const ledgerCents = accounts.find(row => row.slot === 'MARGARET')?.balanceCents
  const [account, setAccount] = useState<MomAccount | null>(null)
  const [payeeSlot, setPayeeSlot] = useState('')
  const [amount, setAmount] = useState('')
  const [toast, setToast] = useState('')
  const [sending, setSending] = useState(false)
  const [view, setView] = useState<View>('home')
  const baseline = useRef('')
  const sealed = useRef(false)
  const me = members.find(member => member.id === currentIdentity())
  const mine = payments
    .filter(payment => payment.elderId === currentIdentity())
    .sort((a, b) => (BigInt(a.id) < BigInt(b.id) ? 1 : -1))
  const active = mine.find(payment => activeStatuses.includes(payment.status))
  const newest = mine[0]
  const family = membersOnPayment(members, active ? [active.elderId] : [])
  const payees = accounts
    .filter(row => row.label.trim() && row.slot !== 'MARGARET' && row.slot !== 'ESCROW')
    .sort((a, b) => a.label.localeCompare(b.label))
  const payeeReason = useRef('')

  useEffect(() => {
    if (payees.length > 0) return
    const reason =
      accounts.length === 0
        ? 'The account subscription has no rows.'
        : 'No payee rows left after hiding Margaret and Escrow.'
    if (payeeReason.current === reason) return
    payeeReason.current = reason
    console.error('No payees yet', reason)
  }, [accounts, payees.length])

  useEffect(() => {
    let cancelled = false
    let retried = false
    let timer = 0

    function refresh() {
      fetchMomAccount()
        .then(snapshot => {
          if (cancelled) return
          if (snapshot?.error) throw new Error(snapshot.error)
          setAccount(snapshot)
        })
        .catch(err => {
          if (cancelled) return
          console.error('Aval account refresh failed', err)
          if (retried) return
          retried = true
          timer = window.setTimeout(refresh, 3000)
        })
    }

    refresh()
    return () => {
      cancelled = true
      window.clearTimeout(timer)
    }
  }, [])

  useEffect(() => {
    const key = newest ? `${newest.id}:${newest.status}` : ''
    if (!sealed.current) {
      baseline.current = key
      if (!currentIdentity()) return
      const timer = window.setTimeout(() => {
        sealed.current = true
        baseline.current = key
      }, 800)
      return () => window.clearTimeout(timer)
    }
    if (baseline.current !== key && newest && resultStatuses.includes(newest.status)) setView('result')
    baseline.current = key
  }, [newest?.id, newest?.status, payments.length, members.length])

  async function onSend() {
    const selected = payees.find(row => row.slot === payeeSlot)
    const payeeName = selected?.label.trim() ?? ''
    const amountCents = dollarsToCents(amount)
    if (!payeeName || amountCents == null || amountCents <= 0) {
      const message = !payeeName ? 'Choose a payee' : 'Enter an amount'
      console.error('requestPayment', message)
      setToast(message)
      return
    }
    setToast('')
    setSending(true)
    try {
      const raw = await computeRiskScore(payeeName, amountCents)
      const result = JSON.parse(raw) as { error?: string; score?: number; held?: boolean }
      if (result.error === 'insufficient_funds') {
        const message = "The balance cannot cover this payment."
        console.error('computeRiskScore', result.error)
        setToast(message)
        return
      }
      if (result.error || result.score == null || result.held == null) {
        const message = result.error || 'The bank did not return a risk score.'
        console.error('computeRiskScore', message)
        setToast(message)
        return
      }
      console.log('requestPayment', { payeeName, amountCents, slot: selected?.slot })
      await requestPayment(payeeName, amountCents)
      setPayeeSlot('')
      setAmount('')
      setView('home')
    } catch (err) {
      const message = err instanceof Error ? err.message : 'The payment did not go through.'
      console.error('requestPayment reducer error', err)
      setToast(message)
    } finally {
      setSending(false)
    }
  }

  const balance = ledgerCents ?? account?.balanceCents
  const screen: View | 'held' =
    view === 'send'
      ? 'send'
      : view === 'secrecy' && active?.status === 'held' && !answered(active)
        ? 'secrecy'
        : active
          ? 'held'
          : view === 'result' && newest && resultStatuses.includes(newest.status)
            ? 'result'
            : 'home'

  return (
    <main className="ruled min-h-screen overflow-x-hidden bg-paper text-ink">
      <div className="mx-auto flex min-h-screen w-full max-w-[440px] flex-col gap-8 px-5 py-8 text-[20px]">
        <Logo className="h-6 w-[112px]" />
        {screen === 'home' && (
          <Home
            name={me?.name || 'Margaret'}
            balance={balance}
            bills={account?.bills ?? []}
            payments={mine}
            onSend={() => setView('send')}
          />
        )}
        {screen === 'send' && (
          <Send
            payees={payees.map(row => ({ id: row.slot, name: row.label }))}
            payeeSlot={payeeSlot}
            amount={amount}
            sending={sending}
            onPayee={setPayeeSlot}
            onAmount={setAmount}
            onBack={() => setView('home')}
            onSubmit={() => void onSend()}
          />
        )}
        {screen === 'held' && active && (
          <Held
            payment={active}
            family={family}
            onContinue={() => setView('secrecy')}
            onCancel={() => void cancelPayment(active.id)}
          />
        )}
        {screen === 'secrecy' && active && (
          <Secrecy
            onYes={() => {
              void confirmPayment(active.id, true)
              setView('home')
            }}
            onNo={() => {
              void confirmPayment(active.id, false)
              setView('home')
            }}
          />
        )}
        {screen === 'result' && newest && <Result payment={newest} onHome={() => setView('home')} />}
        <p className="mt-auto pt-8 text-center">
          <Link to="/join?switch=1" className="font-sans text-sm text-sepia">
            Not you? Switch
          </Link>
        </p>
      </div>
      {toast && (
        <div className="fixed inset-x-0 bottom-6 z-50 flex justify-center px-5">
          <p role="status" className="max-w-[440px] rounded-btn border-2 border-stamp bg-paper px-4 py-3 text-center font-sans text-base text-stamp shadow-scrap">
            {toast}
          </p>
        </div>
      )}
    </main>
  )
}

function Home({
  name,
  balance,
  bills,
  payments,
  onSend,
}: {
  name: string
  balance?: number
  bills: MomAccount['bills']
  payments: Payment[]
  onSend: () => void
}) {
  return (
    <div className="rise-in flex flex-col gap-8">
      <h1 className="font-serif text-[32px] leading-tight">{greeting(name)}</h1>
      <PaperCard tilt className="p-6 pb-8">
        <p className="font-type text-sm text-sepia">Checking</p>
        <p className="mt-3">{balance != null ? <Money cents={balance} size="xl" /> : '—'}</p>
        <p className="mt-4 flex items-center gap-2 font-sans text-base text-sage-ink">
          <Shield size={18} strokeWidth={1.75} aria-hidden />
          Protected by your family
        </p>
      </PaperCard>
      <Button className="min-h-16 text-lg" onClick={onSend}>
        Send money
      </Button>
      <section>
        <h2 className="font-type text-sm text-sepia">Recent</h2>
        <ul className="mt-3 flex flex-col">
          {payments.map(payment => (
            <li key={payment.id} className="flex min-h-16 items-center justify-between gap-3 border-b border-dotted border-sepia/40 py-3">
              <span className="min-w-0">
                <span className="block truncate font-sans text-[20px]">{payment.payeeName}</span>
                <StatusPill status={payment.status} className="mt-2" />
              </span>
              <Money cents={payment.amountCents} size="sm" />
            </li>
          ))}
          {payments.length === 0 && <li className="py-4 font-sans text-base text-sepia">No payments yet.</li>}
        </ul>
      </section>
      {bills.length > 0 && (
        <section>
          <h2 className="font-type text-sm text-sepia">Bills</h2>
          <ul className="mt-3 flex flex-col gap-3">
            {bills.map(bill => (
              <li key={`${bill.payee}-${bill.paymentDate}`} className="flex items-center justify-between font-sans text-base">
                <span>{bill.payee}</span>
                <span className="tabular-nums text-sepia">
                  ${bill.paymentAmount.toFixed(2)} · {bill.status}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  )
}

function Send({
  payees,
  payeeSlot,
  amount,
  sending,
  onPayee,
  onAmount,
  onBack,
  onSubmit,
}: {
  payees: { id: string; name: string }[]
  payeeSlot: string
  amount: string
  sending: boolean
  onPayee: (slot: string) => void
  onAmount: (value: string) => void
  onBack: () => void
  onSubmit: () => void
}) {
  const cents = dollarsToCents(amount)
  const selected = payees.some(row => row.id === payeeSlot)
  return (
    <div className="rise-in flex flex-col gap-6">
      <button type="button" onClick={onBack} className="self-start font-sans text-base text-sepia">
        Back
      </button>
      <h1 className="font-serif text-[32px]">Send money</h1>
      {payees.length === 0 ? (
        <p className="font-sans text-[20px] text-sepia">No payees yet</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {payees.map(row => {
            const chosen = payeeSlot === row.id
            return (
              <li key={row.id}>
                <button
                  type="button"
                  onClick={() => onPayee(row.id)}
                  aria-pressed={chosen}
                  className={`flex min-h-[84px] w-full items-center gap-4 border-2 px-4 text-left ${
                    chosen ? 'border-teal-600 bg-white' : 'border-line bg-paper-2 hover:border-line hover:bg-paper-2'
                  }`}
                >
                  <Avatar name={row.name} size={56} />
                  <span className="font-sans text-[24px]">{row.name}</span>
                  {chosen && <Check className="ml-auto shrink-0 text-teal-600" size={28} strokeWidth={2.5} aria-hidden />}
                </button>
              </li>
            )
          })}
        </ul>
      )}
      <label className="block">
        <span className="font-type text-sm text-sepia">Amount</span>
        <input
          value={amount}
          onChange={event => onAmount(event.target.value)}
          inputMode="decimal"
          placeholder="0.00"
          className="mt-2 h-20 w-full border border-line bg-white px-4 font-sans text-[44px] tabular-nums text-ink"
        />
      </label>
      <Button className="min-h-16" pending={sending} disabled={!selected || cents == null || cents <= 0} onClick={onSubmit}>
        Send
      </Button>
    </div>
  )
}

function Held({
  payment,
  family,
  onContinue,
  onCancel,
}: {
  payment: Payment
  family: { id: string; name: string; online: boolean }[]
  onContinue: () => void
  onCancel: () => void
}) {
  const waiting = payment.status !== 'held' || answered(payment)
  return (
    <div className="rise-in flex flex-1 flex-col items-center pt-4 text-center">
      <PaperCard tilt className="w-full px-5 pb-10 pt-8">
        <WashiTape className="-top-2 left-6" />
        <StatusPill status={payment.status} className="text-base" />
        <h1 className="mt-6 font-serif text-[28px] leading-tight">Held safely at your bank</h1>
        <p className="mt-4 font-sans text-[22px] leading-snug">Your family is looking at it with you.</p>
        <p className="mt-4 font-sans text-base text-sepia">
          {payment.payeeName} · <Money cents={payment.amountCents} size="sm" />
        </p>
        <ul className="mt-6 flex flex-wrap justify-center gap-4">
          {family.map(member => (
            <li key={member.id}>
              <Polaroid name={member.name} online={member.online} />
            </li>
          ))}
        </ul>
      </PaperCard>
      <div className="mt-auto flex w-full flex-col gap-3 pb-4 pt-8">
        {payment.status === 'held' && !waiting && (
          <Button variant="quiet" onClick={onContinue}>
            I still want to send
          </Button>
        )}
        {(payment.status === 'held' || payment.status === 'objection') && (
          <button type="button" onClick={onCancel} className="py-3 font-sans text-base text-sepia">
            Cancel payment
          </button>
        )}
      </div>
    </div>
  )
}

function Secrecy({ onYes, onNo }: { onYes: () => void; onNo: () => void }) {
  return (
    <div className="rise-in flex flex-1 flex-col justify-center">
      <h1 className="text-center font-serif text-[28px] leading-tight">Were you told to keep this secret?</h1>
      <div className="mt-10 grid grid-cols-2 gap-3">
        <Button variant="quiet" className="min-h-28 text-2xl" onClick={onYes}>
          Yes
        </Button>
        <Button variant="quiet" className="min-h-28 text-2xl" onClick={onNo}>
          No
        </Button>
      </div>
    </div>
  )
}

function Result({ payment, onHome }: { payment: Payment; onHome: () => void }) {
  const returned = payment.status === 'refunded' || payment.status === 'refunding'
  const failed = payment.status === 'failed'
  const Icon = returned ? House : failed ? Shield : CheckCircle
  const color = returned ? 'text-sage-ink' : failed ? 'text-stamp' : 'text-blue'
  const sentence = returned
    ? 'The money is back in your account.'
    : failed
      ? 'Something went wrong. Your money is safe.'
      : payment.status === 'sent'
        ? 'The payment was sent.'
        : 'Your family let this payment go through.'
  return (
    <div className="rise-in flex flex-1 flex-col items-center justify-center text-center">
      <StatusPill status={payment.status} className="text-lg" />
      <Icon className={`mt-6 ${color}`} size={48} strokeWidth={1.75} aria-hidden />
      <p className="mt-6 font-sans text-[22px] leading-snug">{sentence}</p>
      <Button className="mt-10" onClick={onHome}>
        Back to home
      </Button>
    </div>
  )
}
