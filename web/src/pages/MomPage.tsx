import { useEffect, useRef, useState } from 'react'
import { CheckCircle, House, Shield, ShieldCheck } from 'lucide-react'
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
import { StatusPill } from '../components/StatusPill'
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
  const [loadError, setLoadError] = useState('')
  const [payee, setPayee] = useState('')
  const [amount, setAmount] = useState('')
  const [notice, setNotice] = useState('')
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

  useEffect(() => {
    fetchMomAccount()
      .then(snapshot => {
        setAccount(snapshot)
        setLoadError(snapshot && 'error' in snapshot ? String((snapshot as { error?: string }).error) : '')
      })
      .catch(() => setLoadError('Could not read the account from the bank.'))
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
    const amountCents = dollarsToCents(amount)
    if (!payee || amountCents == null) return
    setNotice('')
    setSending(true)
    try {
      const raw = await computeRiskScore(payee, amountCents)
      const result = JSON.parse(raw) as { error?: string; score?: number; held?: boolean }
      if (result.error === 'insufficient_funds') {
        setNotice('The balance cannot cover this payment.')
        return
      }
      if (result.error || result.score == null || result.held == null) {
        setNotice('The bank did not return a risk score.')
        return
      }
      await requestPayment(payee, amountCents)
      setAmount('')
      setView('home')
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
    <main className="min-h-screen overflow-x-hidden bg-paper text-ink">
      <div className="mx-auto flex min-h-screen w-full max-w-[440px] flex-col gap-8 px-5 py-8 text-[20px]">
        <Logo className="h-6 w-[112px]" />
        {screen === 'home' && (
          <Home
            name={me?.name || 'Margaret'}
            balance={balance}
            loadError={loadError}
            bills={account?.bills ?? []}
            payments={mine}
            onSend={() => setView('send')}
          />
        )}
        {screen === 'send' && (
          <Send
            customers={account?.customers ?? []}
            payee={payee}
            amount={amount}
            notice={notice}
            sending={sending}
            onPayee={setPayee}
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
      </div>
    </main>
  )
}

function Home({
  name,
  balance,
  loadError,
  bills,
  payments,
  onSend,
}: {
  name: string
  balance?: number
  loadError: string
  bills: MomAccount['bills']
  payments: Payment[]
  onSend: () => void
}) {
  return (
    <div className="rise-in flex flex-col gap-8">
      <h1 className="font-serif text-[32px] font-medium leading-tight">{greeting(name)}</h1>
      <section className="rounded-card bg-white p-6 shadow-vault">
        <p className="text-sm text-muted">Checking</p>
        <p className="mt-3">{balance != null ? <Money cents={balance} size="xl" /> : '—'}</p>
        <p className="mt-4 flex items-center gap-2 text-base text-release">
          <Shield size={18} strokeWidth={1.75} aria-hidden />
          Protected by your family
        </p>
        {loadError && <p className="mt-3 text-base text-alert">{loadError}</p>}
      </section>
      <Button className="min-h-16 text-lg" onClick={onSend}>
        Send money
      </Button>
      <section>
        <h2 className="text-sm font-medium text-muted">Recent</h2>
        <ul className="mt-3 flex flex-col">
          {payments.map(payment => (
            <li key={payment.id} className="flex min-h-16 items-center justify-between gap-3 border-b border-line py-3">
              <span className="min-w-0">
                <span className="block truncate text-[20px]">{payment.payeeName}</span>
                <StatusPill status={payment.status} className="mt-1" />
              </span>
              <Money cents={payment.amountCents} size="sm" />
            </li>
          ))}
          {payments.length === 0 && <li className="py-4 text-base text-muted">No payments yet.</li>}
        </ul>
      </section>
      {bills.length > 0 && (
        <section>
          <h2 className="text-sm font-medium text-muted">Bills</h2>
          <ul className="mt-3 flex flex-col gap-3">
            {bills.map(bill => (
              <li key={`${bill.payee}-${bill.paymentDate}`} className="flex items-center justify-between text-base">
                <span>{bill.payee}</span>
                <span className="tabular-nums text-muted">
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
  customers,
  payee,
  amount,
  notice,
  sending,
  onPayee,
  onAmount,
  onBack,
  onSubmit,
}: {
  customers: MomAccount['customers']
  payee: string
  amount: string
  notice: string
  sending: boolean
  onPayee: (name: string) => void
  onAmount: (value: string) => void
  onBack: () => void
  onSubmit: () => void
}) {
  return (
    <div className="rise-in flex flex-col gap-6">
      <button type="button" onClick={onBack} className="self-start text-base text-muted">
        Back
      </button>
      <h1 className="font-serif text-[32px] font-medium">Send money</h1>
      <ul className="flex flex-col gap-2">
        {customers.map(customer => (
          <li key={customer.id}>
            <button
              type="button"
              onClick={() => onPayee(customer.name)}
              className={`flex min-h-16 w-full items-center gap-3 rounded-card border bg-white px-4 text-left ${
                payee === customer.name ? 'border-2 border-ink' : 'border-line'
              }`}
            >
              <Avatar name={customer.name} size={40} />
              <span className="text-[20px]">{customer.name}</span>
            </button>
          </li>
        ))}
      </ul>
      <label className="block">
        <span className="text-sm text-muted">Amount</span>
        <input
          value={amount}
          onChange={event => onAmount(event.target.value)}
          inputMode="decimal"
          placeholder="0.00"
          className="mt-2 h-20 w-full rounded-card border border-line bg-white px-4 font-sans text-[44px] tabular-nums"
        />
      </label>
      {notice && <p className="text-base text-alert">{notice}</p>}
      <Button className="min-h-16" pending={sending} disabled={!payee || dollarsToCents(amount) == null} onClick={onSubmit}>
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
    <div className="rise-in flex flex-1 flex-col items-center pt-8 text-center">
      <span className="pulse-held flex h-28 w-28 items-center justify-center rounded-full bg-held-bg text-held">
        <ShieldCheck size={48} strokeWidth={1.75} aria-hidden />
      </span>
      <h1 className="mt-8 font-serif text-[28px] font-medium leading-tight">Held safely at your bank</h1>
      <p className="mt-4 text-[22px] leading-snug">Your family is looking at it with you.</p>
      <p className="mt-6 text-base text-muted">
        {payment.payeeName} · <Money cents={payment.amountCents} size="sm" />
      </p>
      <ul className="mt-8 flex flex-wrap justify-center gap-4">
        {family.map(member => (
          <li key={member.id} className="flex w-16 flex-col items-center gap-2">
            <Avatar name={member.name} online={member.online} size={48} />
            <span className="w-full truncate text-sm text-muted">{member.name.split(' ')[0]}</span>
          </li>
        ))}
      </ul>
      <div className="mt-auto flex w-full flex-col gap-3 pb-4 pt-12">
        {payment.status === 'held' && !waiting && (
          <Button variant="quiet" onClick={onContinue}>
            I still want to send
          </Button>
        )}
        {(payment.status === 'held' || payment.status === 'objection') && (
          <button type="button" onClick={onCancel} className="py-3 text-base text-muted">
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
      <h1 className="text-center font-serif text-[28px] font-medium leading-tight">Were you told to keep this secret?</h1>
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
  const color = returned ? 'text-home bg-home-bg' : failed ? 'text-alert bg-alert-bg' : 'text-release bg-release-bg'
  const sentence = returned
    ? 'The money is back in your account.'
    : failed
      ? 'Something went wrong. Your money is safe.'
      : payment.status === 'sent'
        ? 'The payment was sent.'
        : 'Your family let this payment go through.'
  return (
    <div className="rise-in flex flex-1 flex-col items-center justify-center text-center">
      <span className={`flex h-28 w-28 items-center justify-center rounded-full ${color}`}>
        <Icon size={52} strokeWidth={1.75} aria-hidden />
      </span>
      <p className="mt-8 text-[22px] leading-snug">{sentence}</p>
      <Button className="mt-10" onClick={onHome}>
        Back to home
      </Button>
    </div>
  )
}
