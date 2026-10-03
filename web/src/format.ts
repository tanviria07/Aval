export function formatCents(cents: number) {
  return (cents / 100).toLocaleString('en-US', { style: 'currency', currency: 'USD' })
}

export function dollarsToCents(input: string): number | null {
  const trimmed = input.trim()
  if (!trimmed) return null
  const value = Number(trimmed)
  if (!Number.isFinite(value) || value < 0) return null
  return Math.round(value * 100)
}
