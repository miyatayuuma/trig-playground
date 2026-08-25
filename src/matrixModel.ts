import type { Point2 } from './vectorModel'

export const MATRIX_SINGULAR_DWELL_MS = 700

const magnitude = (value: Point2) => Math.hypot(value.x, value.y)
const dot = (a: Point2, b: Point2) => a.x * b.x + a.y * b.y
const clamp01 = (value: number) => Math.max(0, Math.min(1, value))

export const matrixDeterminant = (basisA: Point2, basisB: Point2) =>
  basisA.x * basisB.y - basisA.y * basisB.x

export const determinantTargetProgress = (
  basisA: Point2,
  basisB: Point2,
  revealArea = 0.34,
  minimumMagnitude = 0.38,
) => {
  if (magnitude(basisA) < minimumMagnitude || magnitude(basisB) < minimumMagnitude) return 0
  return clamp01(1 - Math.abs(matrixDeterminant(basisA, basisB)) / revealArea)
}

export const isDeterminantCollapseTarget = (
  basisA: Point2,
  basisB: Point2,
  hitArea = 0.065,
  minimumMagnitude = 0.38,
) => magnitude(basisA) >= minimumMagnitude
  && magnitude(basisB) >= minimumMagnitude
  && Math.abs(matrixDeterminant(basisA, basisB)) <= hitArea

export const nearestCollinearVector = (moving: Point2, axis: Point2): Point2 => {
  const movingLength = magnitude(moving)
  const axisLength = magnitude(axis)
  if (movingLength < 1e-8 || axisLength < 1e-8) return moving

  const direction = { x: axis.x / axisLength, y: axis.y / axisLength }
  const sign = dot(moving, axis) < 0 ? -1 : 1
  return {
    x: direction.x * movingLength * sign,
    y: direction.y * movingLength * sign,
  }
}

export const determinantOrientation = (value: number, epsilon = 0.0005) =>
  Math.abs(value) <= epsilon ? 0 : value > 0 ? 1 : -1
