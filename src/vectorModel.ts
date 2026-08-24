export type Point2 = { x: number; y: number }

export const VECTOR_GRID_VALUES = [-1.5, -1, -0.5, 0, 0.5, 1, 1.5] as const

const distance = (a: Point2, b: Point2) => Math.hypot(a.x - b.x, a.y - b.y)

export const isVectorGatewayGesture = (
  start: Point2,
  end: Point2,
  origin: Point2,
  originRadius = 34,
  minimumTravel = 72,
) => distance(start, origin) <= originRadius && distance(start, end) >= minimumTravel

export const vectorComponentLabel = (value: number) => {
  const rounded = Math.abs(value) < 0.0005 ? 0 : value
  return rounded.toFixed(2)
}
