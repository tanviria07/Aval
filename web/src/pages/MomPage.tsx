import { useEffect, useState } from 'react'
import {
  cancelPayment,
  computeRiskScore,
  confirmPayment,
  currentIdentity,
  fetchMomAccount,
  onAccounts,
  onPayments,
  requestPayment,
  type MomAccount,
  type Payment,
  useRows,
} from '../data'
import { dollarsToCents, formatCents } from '../format'
import { ReasonList } from '../components/ReasonList'

export function MomPage() {
  const payments = useRows(onPayments)
  const accounts = useRows(onAccounts)
  const ledgerCents = accounts.find(row => row.slot === 'MARGARET')?.balanceCents
  const [account, setAccount] = useState<MomAccount | null>(null)
  const [loadError, setLoadError] = useState('')
  const [payee, setPayee] = useState('')
  const [amount, setAmount] = useState('')
  const [notice, setNotice] = useState('')
  const mine = payments.filter(payment => payment.elderId === currentIdentity())

  useEffect(() => {
    fetchMomAccount()
      .then(snapshot => {
        setAccount(snapshot)
        setLoadError(snapshot && 'error' in snapshot ? String((snapshot as { error?: string }).error) : '')
      })
      .catch(() => setLoadError('Could not read Margaret’s account from Nessie.'))
  }, [])

  async function onSend() {
    const amountCents = dollarsToCents(amount)
    if (!payee || amountCents == null) return
    setNotice('')
    const raw = await computeRiskScore(payee, amountCents)
    const result = JSON.parse(raw) as { error?: string; score?: number; held?: boolean; reasons?: unknown }
    if (result.error === 'insufficient_funds') {
      setNotice('Margaret’s balance cannot cover this payment.')
      return
    }
    if (result.error || result.score == null || result.held == null) {
      setNotice('Nessie did not return a risk score.')
      return
    }
    await requestPayment(payee, amountCents)
    setNotice(result.held ? `High risk. Score ${result.score}. Holding for the family.` : `Low risk. Score ${result.score}. Sending.`)
    setAmount('')
  }

  return (
    <main className="min-h-screen bg-canvas px-4 py-8 text-ink">
      <div className="mx-auto flex max-w-lg flex-col gap-6">
        <header>
          <p className="text-sm font-semibold tracking-[0.2em] text-teal">AVAL</p>
          <h1 className="mt-1 text-3xl font-semibold">Mom</h1>
        </header>
        <section className="rounded-2xl bg-surface p-5">
          <p className="text-sm text-slate2">Margaret Chen</p>
          <p className="mt-1 font-mono text-3xl">{ledgerCents != null ? formatCents(ledgerCents) : account ? formatCents(account.balanceCents) : '—'}</p>
          {loadError && <p className="mt-2 text-sm text-red">{loadError}</p>}
          <h2 className="mt-4 text-sm font-semibold">Bills</h2>
          <ul className="mt-2 flex flex-col gap-2">
            {(account?.bills ?? []).map(bill => (
              <li key={`${bill.payee}-${bill.paymentDate}`} className="flex items-center justify-between text-sm">
                <span>{bill.payee}</span>
                <span className="font-mono">
                  ${bill.paymentAmount.toFixed(2)} · {bill.status}
                </span>
              </li>
            ))}
            {account && account.bills.length === 0 && <li className="text-sm text-slate2">No bills returned.</li>}
          </ul>
        </section>
        <section className="rounded-2xl bg-surface p-5">
          <h2 className="text-lg font-semibold">Send money</h2>
          <label className="mt-4 block text-sm font-medium">
            Payee
            <select
              value={payee}
              onChange={event => setPayee(event.target.value)}
              className="mt-1 h-12 w-full rounded-xl border border-slate-300 px-3"
            >
              <option value="">Choose a customer</option>
              {(account?.customers ?? []).map(customer => (
                <option key={customer.id} value={customer.name}>
                  {customer.name}
                </option>
              ))}
            </select>
          </label>
          <label className="mt-4 block text-sm font-medium">
            Amount
            <input
              value={amount}
              onChange={event => setAmount(event.target.value)}
              inputMode="decimal"
              placeholder="340.00"
              className="mt-1 h-12 w-full rounded-xl border border-slate-300 px-3 font-mono"
            />
          </label>
          <button type="button" onClick={() => void onSend()} className="mt-4 h-12 w-full rounded-xl bg-teal font-semibold text-white">
            Send money
          </button>
          {notice && <p className="mt-3 text-sm text-slate2">{notice}</p>}
        </section>
        <section className="flex flex-col gap-3">
          {mine.map(payment => (
            <PaymentActions key={payment.id} payment={payment} />
          ))}
        </section>
      </div>
    </main>
  )
}

function PaymentActions({ payment }: { payment: Payment }) {
  return (
    <article className="rounded-2xl bg-surface p-4">
      <p className="font-semibold">{payment.payeeName}</p>
      <p className="font-mono text-sm">{formatCents(payment.amountCents)} · {payment.status} · score {payment.score}</p>
      <ReasonList reasonsJson={payment.reasonsJson} />
      {payment.status === 'held' && (
        <div className="mt-3">
          <p className="text-sm">Were you told to keep this secret?</p>
          <div className="mt-2 grid grid-cols-2 gap-2">
            <button type="button" onClick={() => void confirmPayment(payment.id, false)} className="h-10 rounded-xl bg-ink text-sm font-semibold text-white">
              No
            </button>
            <button type="button" onClick={() => void confirmPayment(payment.id, true)} className="h-10 rounded-xl bg-slate-200 text-sm font-semibold text-ink">
              Yes
            </button>
          </div>
        </div>
      )}
      {(payment.status === 'held' || payment.status === 'objection') && (
        <button type="button" onClick={() => void cancelPayment(payment.id)} className="mt-2 h-10 w-full rounded-xl bg-red text-sm font-semibold text-white">
          Cancel
        </button>
      )}
    </article>
  )
}
