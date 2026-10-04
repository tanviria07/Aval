import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { join, type Role } from '../data'

const SLOTS = ['A', 'B', 'C', 'D'] as const

export function JoinPage() {
  const navigate = useNavigate()
  const [name, setName] = useState('')
  const [role, setRole] = useState<Role>('mom')
  const [slot, setSlot] = useState<string | null>(null)

  function enter() {
    if (!name.trim() || !slot) return
    join(name.trim(), role, slot)
    navigate(role === 'mom' ? '/mom' : '/guardian')
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-canvas px-4">
      <section className="w-full max-w-[420px] rounded-2xl bg-white p-8 text-ink shadow-xl">
        <p className="text-sm font-semibold tracking-[0.2em] text-teal">AVAL</p>
        <h1 className="mt-2 text-3xl font-semibold">Join</h1>
        <label className="mt-6 block text-left">
          <span className="text-sm font-medium">Name</span>
          <input
            value={name}
            onChange={event => setName(event.target.value)}
            className="mt-1 h-12 w-full rounded-xl border border-slate-300 px-3 outline-none focus:border-amber"
            placeholder="Your name"
          />
        </label>
        <div className="mt-5">
          <p className="text-sm font-medium">Role</p>
          <div className="mt-2 grid grid-cols-2 gap-2">
            {(['mom', 'guardian'] as const).map(option => (
              <button
                key={option}
                type="button"
                onClick={() => setRole(option)}
                className={`h-10 rounded-full text-sm font-semibold capitalize ${
                  role === option ? 'bg-teal text-white' : 'bg-slate-100 text-slate2'
                }`}
              >
                {option === 'mom' ? 'Mom' : 'Guardian'}
              </button>
            ))}
          </div>
        </div>
        <div className="mt-5">
          <p className="text-sm font-medium">Slot</p>
          <div className="mt-2 grid grid-cols-4 gap-2">
            {SLOTS.map(option => (
              <button
                key={option}
                type="button"
                onClick={() => setSlot(option)}
                className={`h-12 rounded-xl text-sm font-semibold ${
                  slot === option ? 'bg-ink text-white' : 'border border-slate-300 text-ink'
                }`}
              >
                {option}
              </button>
            ))}
          </div>
        </div>
        <button
          type="button"
          onClick={enter}
          disabled={!name.trim() || !slot}
          className="mt-6 h-14 w-full rounded-xl bg-teal text-base font-semibold text-white disabled:opacity-40"
        >
          Enter
        </button>
      </section>
    </main>
  )
}
