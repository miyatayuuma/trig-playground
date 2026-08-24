const TAU = Math.PI * 2

export const degreesToRadians = (degrees: number) => (degrees * Math.PI) / 180

export const radiansToDegrees = (radians: number) => (radians * 180) / Math.PI

export const normalizeRadians = (radians: number) => ((radians % TAU) + TAU) % TAU

export const trigValuesFromRadians = (radians: number) => ({
  radians,
  sin: Math.sin(radians),
  cos: Math.cos(radians),
})

export const trigValues = (degrees: number) => trigValuesFromRadians(degreesToRadians(degrees))

export const formatRadians = (radians: number) => {
  if (Math.abs(radians - TAU) < 1e-8) return '2π rad'

  const normalized = normalizeRadians(radians)
  const candidates = [
    { value: 0, label: '0 rad' },
    { value: Math.PI / 6, label: 'π/6 rad' },
    { value: Math.PI / 4, label: 'π/4 rad' },
    { value: Math.PI / 3, label: 'π/3 rad' },
    { value: Math.PI / 2, label: 'π/2 rad' },
    { value: (2 * Math.PI) / 3, label: '2π/3 rad' },
    { value: (3 * Math.PI) / 4, label: '3π/4 rad' },
    { value: (5 * Math.PI) / 6, label: '5π/6 rad' },
    { value: Math.PI, label: 'π rad' },
    { value: (3 * Math.PI) / 2, label: '3π/2 rad' },
  ]

  const match = candidates.find((candidate) => Math.abs(candidate.value - normalized) < 1e-6)
  return match?.label ?? `${normalized.toFixed(3)} rad`
}
