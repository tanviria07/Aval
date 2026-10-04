import { useEffect, useState, type ReactNode } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Wallet, Users } from 'lucide-react'
import { currentIdentity, join, onMembers, plainMessage, useRows, type Role } from '../data'
import { Button } from '../components/Button'
import { Logo } from '../components/Logo'
import { PaperCard } from '../components/PaperCard'
import { WashiTape } from '../components/WashiTape'

const SLOTS = ['A', 'B', 'C', 'D'] as const

export function JoinPage() {
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const switching = params.get('switch') === '1'
  const familyOnly = params.get('role') === 'family'
  const members = useRows(onMembers)
  const [name, setName] = useState('')
  const [picked, setPicked] = useState<Role>(familyOnly ? 'guardian' : 'mom')
  const [toast, setToast] = useState('')
  const [pending, setPending] = useState(false)
  const role: Role = familyOnly ? 'guardian' : picked
  const me = members.find(member => member.id === currentIdentity())

  useEffect(() => {
    if (switching || !me) return
    navigate(me.role === 'mom' ? '/mom' : '/guardian', { replace: true })
  }, [switching, me, navigate])

  function pickSlot() {
    const used = new Set(members.map(member => member.slot))
    const choices = role === 'mom' ? SLOTS : (['B', 'C', 'D'] as const)
    return choices.find(slot => !used.has(slot)) ?? choices[0]
  }

  async function enter() {
    if (!name.trim() || pending) return
    setToast('')
    setPending(true)
    try {
      await join(name.trim(), role, pickSlot())
      navigate(role === 'mom' ? '/mom' : '/guardian')
    } catch (err) {
      console.error('join', err)
      setToast(plainMessage(err, 'Could not join.'))
    } finally {
      setPending(false)
    }
  }

  return (
    <main className="flex min-h-screen justify-center overflow-x-hidden bg-paper px-5 py-16 text-ink">
      <section className="flex w-full max-w-[420px] flex-col">
        <Logo />
        <h1 className="mt-10 font-serif text-[34px] leading-tight">Who are you in this family?</h1>
        <div className="mt-8 flex flex-col gap-4">
          {!familyOnly && (
            <RoleCard
              selected={role === 'mom'}
              title="I'm Mom"
              detail="I send payments from my account"
              icon={<Wallet strokeWidth={1.75} className="text-stamp" />}
              onClick={() => setPicked('mom')}
            />
          )}
          <RoleCard
            selected={role === 'guardian'}
            title="I'm family"
            detail="I help keep those payments safe"
            icon={<Users strokeWidth={1.75} className="text-sage-ink" />}
            onClick={() => setPicked('guardian')}
          />
        </div>
        <label className="mt-8 block">
          <span className="sr-only">Name</span>
          <input
            value={name}
            onChange={event => setName(event.target.value)}
            placeholder="Your name"
            className="h-14 w-full rounded-btn border border-line bg-white px-4 font-sans text-lg text-ink"
          />
        </label>
        <Button className="mt-4" disabled={!name.trim()} pending={pending} onClick={() => void enter()}>
          Continue
        </Button>
      </section>
      {toast && (
        <div className="fixed inset-x-0 bottom-6 z-50 flex justify-center px-5">
          <p role="status" className="max-w-[420px] rounded-btn border-2 border-stamp bg-paper px-4 py-3 text-center font-sans text-base text-stamp shadow-scrap">
            {toast}
          </p>
        </div>
      )}
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
    <PaperCard tilt className={selected ? 'border-2 border-ink' : ''}>
      <button type="button" onClick={onClick} aria-pressed={selected} className="relative flex w-full items-start gap-4 p-5 pb-7 text-left">
        <WashiTape pattern={selected ? 'rose' : 'gingham'} className="-top-2 left-4" />
        <span className="mt-1">{icon}</span>
        <span>
          <span className="block font-serif text-2xl">{title}</span>
          <span className="mt-1 block font-sans text-sepia">{detail}</span>
        </span>
      </button>
    </PaperCard>
  )
}
