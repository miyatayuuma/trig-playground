export type Point2 = { x: number; y: number }

export const VECTOR_GRID_VALUES = [-1.5, -1, -0.5, 0, 0.5, 1, 1.5] as const
export const VECTOR_MAX_MAGNITUDE = 1.45
export const SECOND_VECTOR_MAX_MAGNITUDE = 1.2
export const DEFAULT_SECOND_VECTOR: Point2 = { x: -0.55, y: 0.72 }
export const ADDITION_TARGET_DWELL_MS = 700
export const ORTHOGONAL_TARGET_DWELL_MS = 700

const distance = (a: Point2, b: Point2) => Math.hypot(a.x - b.x, a.y - b.y)
const dot = (a: Point2, b: Point2) => a.x * b.x + a.y * b.y
const cross = (a: Point2, b: Point2) => a.x * b.y - a.y * b.x
const subtract = (a: Point2, b: Point2): Point2 => ({ x: a.x - b.x, y: a.y - b.y })
const magnitude = (value: Point2) => Math.hypot(value.x, value.y)
const normalize = (value: Point2): Point2 => {
  const length = magnitude(value)
  return length < 1e-8 ? { x: 0, y: 0 } : { x: value.x / length, y: value.y / length }
}
const clamp01 = (value: number) => Math.max(0, Math.min(1, value))

export const isVectorGatewayGesture = (
  start: Point2,
  end: Point2,
  origin: Point2,
  originRadius = 34,
  minimumTravel = 72,
) => distance(start, origin) <= originRadius && distance(start, end) >= minimumTravel

export const isRadiusTraceStart = (
  point: Point2,
  origin: Point2,
  originRadius = 38,
) => distance(point, origin) <= originRadius

export const radiusTraceProgress = (
  point: Point2,
  origin: Point2,
  endpoint: Point2,
  maximumSideDistance = 48,
) => {
  const axis = subtract(endpoint, origin)
  const axisLength = magnitude(axis)
  if (axisLength < 1) return 0

  const direction = normalize(axis)
  const travel = subtract(point, origin)
  const forward = dot(travel, direction)
  const side = Math.abs(cross(travel, direction))

  if (forward < 0 || side > maximumSideDistance) return 0
  return clamp01(forward / axisLength)
}

export const isRadiusTraceComplete = (
  point: Point2,
  origin: Point2,
  endpoint: Point2,
  minimumProgress = 0.82,
  maximumSideDistance = 48,
) => {
  const axis = subtract(endpoint, origin)
  const axisLength = magnitude(axis)
  if (axisLength < 1) return false

  const direction = normalize(axis)
  const travel = subtract(point, origin)
  const forward = dot(travel, direction)
  const side = Math.abs(cross(travel, direction))

  return forward / axisLength >= minimumProgress && side <= maximumSideDistance
}

export const clampVectorMagnitude = (
  value: Point2,
  maximum = VECTOR_MAX_MAGNITUDE,
): Point2 => {
  const length = magnitude(value)
  if (length <= maximum || length < 1e-8) return value
  const scale = maximum / length
  return { x: value.x * scale, y: value.y * scale }
}

export const screenPointToVector = (
  point: Point2,
  origin: Point2,
  xBasisPoint: Point2,
  yBasisPoint: Point2,
): Point2 => {
  const delta = subtract(point, origin)
  const xBasis = subtract(xBasisPoint, origin)
  const yBasis = subtract(yBasisPoint, origin)
  const determinant = xBasis.x * yBasis.y - xBasis.y * yBasis.x

  if (Math.abs(determinant) < 1e-8) return { x: 0, y: 0 }

  return {
    x: (delta.x * yBasis.y - delta.y * yBasis.x) / determinant,
    y: (xBasis.x * delta.y - xBasis.y * delta.x) / determinant,
  }
}

export const componentPullProgress = (
  start: Point2,
  end: Point2,
  outwardDirection: Point2,
  completionDistance = 74,
) => {
  const direction = normalize(outwardDirection)
  const travel = subtract(end, start)
  const forward = dot(travel, direction)
  return clamp01(forward / completionDistance)
}

export const isComponentGatewayGesture = (
  start: Point2,
  end: Point2,
  outwardDirection: Point2,
  minimumForwardTravel = 62,
  maximumSideTravel = 42,
) => {
  const direction = normalize(outwardDirection)
  if (magnitude(direction) < 0.5) return false

  const travel = subtract(end, start)
  const forward = dot(travel, direction)
  const sideDirection = { x: -direction.y, y: direction.x }
  const side = Math.abs(dot(travel, sideDirection))

  return forward >= minimumForwardTravel && side <= maximumSideTravel
}

export const componentGatewayVisibility = (
  vector: Point2,
  currentlyVisible: boolean,
  enterRadius = 1.12,
  exitRadius = 1.02,
  enterMinimumComponent = 0.22,
  exitMinimumComponent = 0.12,
) => {
  const radius = magnitude(vector)
  const minimumComponent = Math.min(Math.abs(vector.x), Math.abs(vector.y))
  if (currentlyVisible) {
    return radius >= exitRadius && minimumComponent >= exitMinimumComponent
  }
  return radius >= enterRadius && minimumComponent >= enterMinimumComponent
}

export const componentTargetProgress = (
  point: Point2,
  target: Point2,
  revealDistance = 150,
) => clamp01(1 - distance(point, target) / revealDistance)

export const isComponentTargetHit = (
  point: Point2,
  target: Point2,
  snapDistance = 28,
) => distance(point, target) <= snapDistance

export const secondVectorPullProgress = (
  start: Point2,
  end: Point2,
  completionDistance = 72,
) => clamp01(distance(start, end) / completionDistance)

export const isSecondVectorGatewayGesture = (
  start: Point2,
  end: Point2,
  origin: Point2,
  minimumTravel = 56,
  minimumDistanceFromOrigin = 42,
) => distance(start, end) >= minimumTravel && distance(end, origin) >= minimumDistanceFromOrigin

export const addVectors = (a: Point2, b: Point2): Point2 => ({
  x: a.x + b.x,
  y: a.y + b.y,
})

export const additionPuzzleSecondVector = (
  vector: Point2,
  along = 0.52,
  across = 0.58,
): Point2 => {
  const direction = normalize(vector)
  if (magnitude(direction) < 0.5) return DEFAULT_SECOND_VECTOR
  const perpendicular = { x: -direction.y, y: direction.x }
  return {
    x: direction.x * along + perpendicular.x * across,
    y: direction.y * along + perpendicular.y * across,
  }
}

export const additionTargetProgress = (
  sum: Point2,
  target: Point2,
  revealDistance = 0.34,
) => clamp01(1 - distance(sum, target) / revealDistance)

export const isAdditionTargetHit = (
  sum: Point2,
  target: Point2,
  hitDistance = 0.105,
) => distance(sum, target) <= hitDistance

export const targetDwellProgress = (
  elapsedMs: number,
  requiredMs = ADDITION_TARGET_DWELL_MS,
) => clamp01(elapsedMs / Math.max(1, requiredMs))

export const dotProduct = (a: Point2, b: Point2) => dot(a, b)

export const projectVectorOnto = (value: Point2, axis: Point2): Point2 => {
  const denominator = dot(axis, axis)
  if (denominator < 1e-8) return { x: 0, y: 0 }
  const scale = dot(value, axis) / denominator
  return { x: axis.x * scale, y: axis.y * scale }
}

export const vectorCosine = (a: Point2, b: Point2) => {
  const denominator = magnitude(a) * magnitude(b)
  if (denominator < 1e-8) return 0
  return Math.max(-1, Math.min(1, dot(a, b) / denominator))
}

export const orthogonalTargetProgress = (
  a: Point2,
  b: Point2,
  revealCosine = 0.42,
  minimumMagnitude = 0.35,
) => {
  if (magnitude(a) < minimumMagnitude || magnitude(b) < minimumMagnitude) return 0
  return clamp01(1 - Math.abs(vectorCosine(a, b)) / revealCosine)
}

export const isOrthogonalTargetHit = (
  a: Point2,
  b: Point2,
  cosineTolerance = 0.055,
  minimumMagnitude = 0.35,
) => magnitude(a) >= minimumMagnitude
  && magnitude(b) >= minimumMagnitude
  && Math.abs(vectorCosine(a, b)) <= cosineTolerance

export const nearestPerpendicularVector = (value: Point2, axis: Point2): Point2 => {
  const axisDirection = normalize(axis)
  const valueLength = magnitude(value)
  if (magnitude(axisDirection) < 0.5 || valueLength < 1e-8) return value

  const perpendicular = { x: -axisDirection.y, y: axisDirection.x }
  const positive = { x: perpendicular.x * valueLength, y: perpendicular.y * valueLength }
  const negative = { x: -positive.x, y: -positive.y }
  return distance(value, positive) <= distance(value, negative) ? positive : negative
}

export const projectionDropProgress = (
  point: Point2,
  start: Point2,
  target: Point2,
  maximumSideDistance = 44,
) => {
  const axis = subtract(target, start)
  const axisLength = magnitude(axis)
  if (axisLength < 1) return 0
  const direction = normalize(axis)
  const travel = subtract(point, start)
  const forward = dot(travel, direction)
  const side = Math.abs(cross(travel, direction))
  if (forward < 0 || side > maximumSideDistance) return 0
  return clamp01(forward / axisLength)
}

export const isProjectionDropReady = (
  point: Point2,
  start: Point2,
  target: Point2,
  minimumProgress = 0.86,
  maximumSideDistance = 44,
) => {
  const axis = subtract(target, start)
  const axisLength = magnitude(axis)
  if (axisLength < 1) return false
  const direction = normalize(axis)
  const travel = subtract(point, start)
  const forward = dot(travel, direction)
  const side = Math.abs(cross(travel, direction))
  return forward / axisLength >= minimumProgress && side <= maximumSideDistance
}

export const vectorMagnitude = (value: Point2) => magnitude(value)
export const vectorAngle = (value: Point2) => Math.atan2(value.y, value.x)

export const unwrapAngleNear = (reference: number, angle: number) => {
  const tau = Math.PI * 2
  return angle + Math.round((reference - angle) / tau) * tau
}

export const vectorComponentLabel = (value: number) => {
  const rounded = Math.abs(value) < 0.0005 ? 0 : value
  return rounded.toFixed(2)
}
