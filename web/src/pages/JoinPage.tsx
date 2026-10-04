import { useState, type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { Wallet, Users } from 'lucide-react'
import { join, onMembers, useRows, type Role } from '../data'
import { Button } from '../components/Button'
import { Logo } from '../components/Logo'

const SLOTS = ['A', 'B', 'C', 'D'] as const

export function JoinPage() {
  const navigate = useNavigate()
  const members = useRows(onMembers)
  const [name, setName] = useState('')
  const [role, setRole] = useState<Role>('mom')

  function pickSlot() {
    const used = new Set(members.map(member => member.slot))
    const choices = role === 'mom' ? SLOTS : (['B', 'C', 'D'] as const)
    return choices.find(slot => !used.has(slot)) ?? choices[0]
  }

  function enter() {
    if (!name.trim()) return
    join(name.trim(), role, pickSlot())
    navigate(role === 'mom' ? '/mom' : '/guardian')
  }

  return (
    <main className="flex min-h-screen justify-center overflow-x-hidden bg-paper px-5 py-16 text-ink">
      <section className="flex w-full max-w-[420px] flex-col">
        <Logo />
        <h1 className="mt-10 font-serif text-[34px] font-medium leading-tight">Who are you in this family?</h1>
        <div className="mt-8 flex flex-col gap-3">
          <RoleCard
            selected={role === 'mom'}
            title="I'm Mom"
            detail="I send payments from my account"
            icon={<Wallet strokeWidth={1.75} className="text-release" />}
            onClick={() => setRole('mom')}
          />
          <RoleCard
            selected={role === 'guardian'}
            title="I'm family"
            detail="I help keep those payments safe"
            icon={<Users strokeWidth={1.75} className="text-release" />}
            onClick={() => setRole('guardian')}
          />
        </div>
        <label className="mt-8 block">
          <span className="sr-only">Name</span>
          <input
            value={name}
            onChange={event => setName(event.target.value)}
            placeholder="Your name"
            className="h-14 w-full rounded-btn border border-line bg-white px-4 text-lg"
          />
        </label>
        <Button className="mt-4" disabled={!name.trim()} onClick={enter}>
          Continue
        </Button>
      </section>
    </main>
  )
}

function RoleCard({
  selected,
  title,
  detail,
  icon,
  onClick,
}: {
  selected: boolean
  title: string
  detail: string
  icon: ReactNode
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      className={`flex items-start gap-4 rounded-card border bg-white p-5 text-left shadow-vault transition-colors duration-vault ease-vault ${
        selected ? 'border-2 border-ink' : 'border-line'
      }`}
    >
      <span className="mt-1">{icon}</span>
      <span>
        <span className="block font-serif text-2xl font-medium">{title}</span>
        <span className="mt-1 block text-muted">{detail}</span>
      </span>
    </button>
  )
}
