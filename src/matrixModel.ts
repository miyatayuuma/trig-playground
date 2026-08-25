import type { Point2 } from './vectorModel'

export const MATRIX_SINGULAR_DWELL_MS = 700
export const MATRIX_FLIP_DWELL_MS = 520
export const EIGENVECTOR_DWELL_MS = 700

const magnitude = (value: Point2) => Math.hypot(value.x, value.y)
const dot = (a: Point2, b: Point2) => a.x * b.x + a.y * b.y
const clamp01 = (value: number) => Math.max(0, Math.min(1, value))
const normalize = (value: Point2): Point2 => {
  const length = magnitude(value)
  return length < 1e-8 ? { x: 0, y: 0 } : { x: value.x / length, y: value.y / length }
}

export const matrixDeterminant = (basisA: Point2, basisB: Point2) =>
  basisA.x * basisB.y - basisA.y * basisB.x

export const matrixTrace = (basisA: Point2, basisB: Point2) => basisA.x + basisB.y

export const applyMatrix = (basisA: Point2, basisB: Point2, value: Point2): Point2 => ({
  x: basisA.x * value.x + basisB.x * value.y,
  y: basisA.y * value.x + basisB.y * value.y,
})

export const eigenDiscriminant = (basisA: Point2, basisB: Point2) => {
  const trace = matrixTrace(basisA, basisB)
  return trace * trace - 4 * matrixDeterminant(basisA, basisB)
}

const eigenvectorForValue = (basisA: Point2, basisB: Point2, lambda: number): Point2 | null => {
  const first = { x: basisB.x, y: lambda - basisA.x }
  const second = { x: lambda - basisB.y, y: basisA.y }
  const candidate = magnitude(first) >= magnitude(second) ? first : second
  if (magnitude(candidate) < 1e-7) return null
  return normalize(candidate)
}

export const realEigenDirections = (basisA: Point2, basisB: Point2, epsilon = 1e-8): Point2[] => {
  const discriminant = eigenDiscriminant(basisA, basisB)
  if (discriminant < -epsilon) return []

  const trace = matrixTrace(basisA, basisB)
  const root = Math.sqrt(Math.max(0, discriminant))
  const lambdas = [(trace + root) / 2, (trace - root) / 2]
  const directions = lambdas
    .map((lambda) => eigenvectorForValue(basisA, basisB, lambda))
    .filter((value): value is Point2 => value !== null)

  if (directions.length === 0) {
    const scalarLike = Math.abs(basisB.x) < epsilon
      && Math.abs(basisA.y) < epsilon
      && Math.abs(basisA.x - basisB.y) < epsilon
    return scalarLike ? [{ x: 1, y: 0 }] : []
  }

  if (directions.length === 2 && Math.abs(dot(directions[0], directions[1])) > 0.9995) {
    return [directions[0]]
  }
  return directions
}

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

export const determinantFlipProgress = (determinant: number, revealAt = -0.04, completeAt = -0.22) => {
  if (determinant >= revealAt) return 0
  return clamp01((revealAt - determinant) / Math.max(1e-6, revealAt - completeAt))
}

export const isDeterminantFlipReady = (determinant: number, threshold = -0.22) => determinant <= threshold

export const eigenDirectionParallelCosine = (basisA: Point2, basisB: Point2, probe: Point2) => {
  const probeLength = magnitude(probe)
  const transformed = applyMatrix(basisA, basisB, probe)
  const transformedLength = magnitude(transformed)
  if (probeLength < 1e-8 || transformedLength < 1e-8) return 0
  return Math.abs(dot(probe, transformed) / (probeLength * transformedLength))
}

export const eigenDirectionProgress = (
  basisA: Point2,
  basisB: Point2,
  probe: Point2,
  revealCosine = Math.cos(24 * Math.PI / 180),
  minimumTransformedMagnitude = 0.14,
) => {
  if (realEigenDirections(basisA, basisB).length === 0) return 0
  if (magnitude(applyMatrix(basisA, basisB, probe)) < minimumTransformedMagnitude) return 0
  const cosine = eigenDirectionParallelCosine(basisA, basisB, probe)
  return clamp01((cosine - revealCosine) / Math.max(1e-6, 1 - revealCosine))
}

export const isEigenDirectionHit = (
  basisA: Point2,
  basisB: Point2,
  probe: Point2,
  cosineThreshold = Math.cos(4 * Math.PI / 180),
  minimumProbeMagnitude = 0.35,
  minimumTransformedMagnitude = 0.14,
) => magnitude(probe) >= minimumProbeMagnitude
  && magnitude(applyMatrix(basisA, basisB, probe)) >= minimumTransformedMagnitude
  && realEigenDirections(basisA, basisB).length > 0
  && eigenDirectionParallelCosine(basisA, basisB, probe) >= cosineThreshold

export const nearestEigenDirection = (
  basisA: Point2,
  basisB: Point2,
  probe: Point2,
): Point2 => {
  const directions = realEigenDirections(basisA, basisB)
  const probeLength = magnitude(probe)
  if (directions.length === 0 || probeLength < 1e-8) return probe

  let best = directions[0]
  let bestScore = -Infinity
  for (const direction of directions) {
    const score = Math.abs(dot(normalize(probe), direction))
    if (score > bestScore) {
      best = direction
      bestScore = score
    }
  }

  const sign = dot(probe, best) < 0 ? -1 : 1
  return { x: best.x * probeLength * sign, y: best.y * probeLength * sign }
}

export const eigenScale = (basisA: Point2, basisB: Point2, probe: Point2) => {
  const denominator = dot(probe, probe)
  if (denominator < 1e-8) return 0
  return dot(applyMatrix(basisA, basisB, probe), probe) / denominator
}
