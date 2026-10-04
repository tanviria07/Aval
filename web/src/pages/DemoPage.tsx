import { useEffect, useState } from 'react'
import { ReasonList } from '../components/ReasonList'
import { NessieLogRow } from '../components/NessieLogRow'
import {
  fetchMomAccount,
  onMembers,
  onNessieLog,
  onPayments,
  pausePayment,
  stopPayment,
  type MomAccount,
  useRows,
} from '../data'
import { formatCents } from '../format'

export function DemoPage() {
  const members = useRows(onMembers)
  const payments = useRows(onPayments)
  const logs = useRows(onNessieLog)
  const [account, setAccount] = useState<MomAccount | null>(null)
  const held = [...payments].filter(payment => payment.status === 'held').sort((a, b) => (BigInt(a.id) < BigInt(b.id) ? 1 : -1))[0]
  const guardians = members.filter(member => member.role === 'guardian')

  useEffect(() => {
    fetchMomAccount().then(setAccount).catch(() => setAccount(null))
  }, [])

  return (
    <main className="min-h-screen overflow-auto bg-canvas">
      <div className="flex h-[1080px] w-[1920px] flex-col bg-canvas text-ink">
        <header className="flex h-[72px] shrink-0 items-center px-10">
          <p className="text-sm font-semibold tracking-[0.22em] text-teal">AVAL</p>
        </header>
        <div className="grid min-h-0 flex-1 grid-cols-3 gap-8 px-10">
          <section className="rounded-3xl bg-surface p-6">
            <p className="text-sm font-semibold text-slate2">Mom</p>
            <p className="mt-2 text-2xl font-semibold">Margaret Chen</p>
            <p className="mt-2 font-mono text-3xl">{account ? formatCents(account.balanceCents) : '—'}</p>
            <ul className="mt-4 flex flex-col gap-2 text-sm">
              {(account?.bills ?? []).map(bill => (
                <li key={`${bill.payee}-${bill.paymentDate}`} className="flex justify-between">
                  <span>{bill.payee}</span>
                  <span className="font-mono">${bill.paymentAmount.toFixed(2)}</span>
                </li>
              ))}
            </ul>
          </section>
          <section className="rounded-3xl bg-surface p-6">
            <p className="text-sm font-semibold text-slate2">Held payment</p>
            {held ? (
              <>
                <h2 className="mt-2 text-3xl font-semibold">{held.payeeName}</h2>
                <p className="mt-2 font-mono text-2xl">{formatCents(held.amountCents)}</p>
                <p className="mt-1 text-sm text-slate2">Score {held.score}</p>
                <ReasonList reasonsJson={held.reasonsJson} />
              </>
            ) : (
              <p className="mt-4 text-slate2">No held payment.</p>
            )}
          </section>
          <section className="rounded-3xl bg-surface p-6">
            <p className="text-sm font-semibold text-slate2">Guardians</p>
            <ul className="mt-3 flex flex-col gap-2 text-sm">
              {guardians.map(member => (
                <li key={member.id} className="flex items-center justify-between">
                  <span>{member.name}</span>
                  <span className={`h-2.5 w-2.5 rounded-full ${member.online ? 'bg-green' : 'bg-slate-500'}`} />
                </li>
              ))}
            </ul>
            {held && (
              <div className="mt-6 grid grid-cols-3 gap-2">
                <button type="button" onClick={() => void pausePayment(held.id)} className="h-10 rounded-xl bg-amber text-sm font-semibold">
                  Pause
                </button>
                <button type="button" onClick={() => void stopPayment(held.id)} className="h-10 rounded-xl bg-red text-sm font-semibold text-white">
                  Stop
                </button>
                <button type="button" disabled className="h-10 rounded-xl bg-slate-200 text-sm font-semibold text-slate2">
                  Approve
                </button>
              </div>
            )}
          </section>
        </div>
        <div className="flex h-48 shrink-0 flex-col gap-2 overflow-auto px-10 py-4">
          {logs.map(log => (
            <NessieLogRow key={log.id} log={log} />
          ))}
        </div>
      </div>
    </main>
  )
}
