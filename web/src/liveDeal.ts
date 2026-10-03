import { useSyncExternalStore } from 'react'
import { mockDeals, type Deal } from './data'

export type SealedLimits = {
  floorCents?: number
  ceilingCents?: number
}

type Snapshot = {
  deal: Deal
  limits: SealedLimits
  buyerInDeal: boolean
}

let snapshot: Snapshot = {
  deal: { ...mockDeals[0] },
  limits: {},
  buyerInDeal: false,
}

const listeners = new Set<() => void>()

function emit() {
  listeners.forEach((cb) => cb())
}

export function subscribeLive(cb: () => void) {
  listeners.add(cb)
  return () => {
    listeners.delete(cb)
  }
}

export function getLive(): Snapshot {
  return snapshot
}

export function useLive() {
  return useSyncExternalStore(subscribeLive, getLive, getLive)
}

export function updateLive(patch: Partial<Deal>, limits?: SealedLimits) {
  snapshot = {
    ...snapshot,
    deal: { ...snapshot.deal, ...patch },
    limits: limits ? { ...snapshot.limits, ...limits } : snapshot.limits,
  }
  emit()
}

export function enterBuyerDeal(ceilingCents: number) {
  snapshot = {
    ...snapshot,
    buyerInDeal: true,
    limits: { ...snapshot.limits, ceilingCents },
  }
  emit()
}
