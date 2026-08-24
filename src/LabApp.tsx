import {
  useEffect,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type PointerEvent as ReactPointerEvent,
} from 'react'
import { conceptLabel, type ConceptId } from './concepts'
import {
  normalizeRadians,
  radiansToDegrees,
  trigValuesFromRadians,
} from './math'
import {
  clampVectorMagnitude,
  componentPullProgress,
  isComponentGatewayGesture,
  isVectorGatewayGesture,
  screenPointToVector,
  unwrapAngleNear,
  VECTOR_GRID_VALUES,
  VECTOR_MAX_MAGNITUDE,
  vectorAngle,
  vectorComponentLabel,
  vectorMagnitude,
  type Point2,
} from './vectorModel'

const TAU = Math.PI * 2
const VIEW_WIDTH = 760
const VIEW_HEIGHT = 430
const BOX_LENGTH = 5.4
const BOX_CYCLE_LENGTH = 1.48
const FACE_EXTENT = 1.15
const PLAYBACK_SPEED = 0.85
const CAMERA_TRANSITION_MS = 800
const CONCEPT_TRANSITION_MS = 720
const COMPONENT_TRANSITION_MS = 520
const VECTOR_GRID_EXTENT = 1.5

type ViewMode = 'box' | 'circle' | 'sin' | 'cos'
type FlatView = Exclude<ViewMode, 'box'>
type LiveConcept = Extract<ConceptId, 'trig' | 'vector' | 'vector-components'>
type Vec3 = { x: number; y: number; z: number }
type Point = { x: number; y: number }
type CameraPose = {
  position: Vec3
  target: Vec3
  up: Vec3
  focal: number
}
type CameraState = {
  pose: CameraPose
  isolation: number
}
type TrailSegment = {
  start: Vec3
  end: Vec3
  opacity: number
}
type Gesture = {
  clientX: number
  clientY: number
  pointerId: number
  svgPoint: Point2
}
type ComponentDrag = {
  pointerId: number
  start: Point2
  direction: Point2
}

const BOX_CAMERA: CameraPose = {
  position: { x: -2, y: -4, z: 2 },
  target: { x: 2, y: 0, z: 0.5 },
  up: { x: 0, y: 0, z: 1 },
  focal: 760,
}

const VIEW_CAMERAS: Record<FlatView, CameraPose> = {
  circle: {
    position: { x: -0.65, y: 0, z: 0 },
    target: { x: BOX_LENGTH, y: 0, z: 0 },
    up: { x: 0, y: 0, z: 1 },
    focal: 980,
  },
  sin: {
    position: { x: BOX_LENGTH / 2, y: -5, z: 0.2 },
    target: { x: BOX_LENGTH / 2, y: FACE_EXTENT, z: 0 },
    up: { x: 0, y: 0, z: 1 },
    focal: 780,
  },
  cos: {
    position: { x: BOX_LENGTH / 2, y: 0, z: -6.2 },
    target: { x: BOX_LENGTH / 2, y: 0, z: -FACE_EXTENT },
    up: { x: 0, y: -1, z: 0 },
    focal: 820,
  },
}

const subtract = (a: Vec3, b: Vec3): Vec3 => ({ x: a.x - b.x, y: a.y - b.y, z: a.z - b.z })
const scale = (vector: Vec3, amount: number): Vec3 => ({
  x: vector.x * amount,
  y: vector.y * amount,
  z: vector.z * amount,
})
const dot = (a: Vec3, b: Vec3) => a.x * b.x + a.y * b.y + a.z * b.z
const cross = (a: Vec3, b: Vec3): Vec3 => ({
  x: a.y * b.z - a.z * b.y,
  y: a.z * b.x - a.x * b.z,
  z: a.x * b.y - a.y * b.x,
})
const magnitude3 = (vector: Vec3) => Math.hypot(vector.x, vector.y, vector.z)
const normalize3 = (vector: Vec3): Vec3 => {
  const length = magnitude3(vector)
  return length < 1e-8 ? { x: 0, y: 0, z: 0 } : scale(vector, 1 / length)
}
const lerp = (from: number, to: number, t: number) => from + (to - from) * t
const lerpVec = (from: Vec3, to: Vec3, t: number): Vec3 => ({
  x: lerp(from.x, to.x, t),
  y: lerp(from.y, to.y, t),
  z: lerp(from.z, to.z, t),
})
const lerpCamera = (from: CameraPose, to: CameraPose, t: number): CameraPose => ({
  position: lerpVec(from.position, to.position, t),
  target: lerpVec(from.target, to.target, t),
  up: normalize3(lerpVec(from.up, to.up, t)),
  focal: lerp(from.focal, to.focal, t),
})
const smootherStep = (t: number) => t * t * t * (t * (t * 6 - 15) + 10)

const projectPoint = (point: Vec3, camera: CameraPose): Point => {
  const forward = normalize3(subtract(camera.target, camera.position))
  const right = normalize3(cross(forward, camera.up))
  const trueUp = normalize3(cross(right, forward))
  const relative = subtract(point, camera.position)
  const depth = Math.max(0.35, dot(relative, forward))
  const perspective = camera.focal / depth

  return {
    x: VIEW_WIDTH / 2 + dot(relative, right) * perspective,
    y: VIEW_HEIGHT / 2 - dot(relative, trueUp) * perspective,
  }
}

const pointString = (point: Point) => `${point.x.toFixed(2)},${point.y.toFixed(2)}`
const pointsString = (points: Vec3[], camera: CameraPose) =>
  points.map((point) => pointString(projectPoint(point, camera))).join(' ')

const pathFromWorldPoints = (points: Vec3[], camera: CameraPose) =>
  points.map((point, index) => {
    const projected = projectPoint(point, camera)
    return `${index === 0 ? 'M' : 'L'} ${projected.x.toFixed(2)} ${projected.y.toFixed(2)}`
  }).join(' ')

const endFace = (x: number): Vec3[] => [
  { x, y: -FACE_EXTENT, z: -FACE_EXTENT },
  { x, y: FACE_EXTENT, z: -FACE_EXTENT },
  { x, y: FACE_EXTENT, z: FACE_EXTENT },
  { x, y: -FACE_EXTENT, z: FACE_EXTENT },
]

const wavePoint = (phase: number, kind: 'sin' | 'cos', x: number): Vec3 => {
  const distanceFromCircle = BOX_LENGTH - x
  const radians = phase - (distanceFromCircle / BOX_CYCLE_LENGTH) * TAU

  if (kind === 'sin') return { x, y: FACE_EXTENT, z: Math.sin(radians) }
  return { x, y: Math.cos(radians), z: -FACE_EXTENT }
}

const trailOpacity = (x: number) => {
  const progressFromOldestEnd = x / BOX_LENGTH
  const fadeEnd = 0.48
  if (progressFromOldestEnd >= fadeEnd) return 1
  return 0.09 + 0.91 * smootherStep(progressFromOldestEnd / fadeEnd)
}

const buildWaveSegments = (
  phase: number,
  kind: 'sin' | 'cos',
  visibleStartX: number,
): TrailSegment[] => {
  const visibleLength = BOX_LENGTH - visibleStartX
  if (visibleLength <= 0.0001) return []

  const segmentCount = Math.max(2, Math.ceil(180 * (visibleLength / BOX_LENGTH)))
  return Array.from({ length: segmentCount }, (_, index) => {
    const x0 = visibleStartX + (index / segmentCount) * visibleLength
    const x1 = visibleStartX + ((index + 1) / segmentCount) * visibleLength
    return {
      start: wavePoint(phase, kind, x0),
      end: wavePoint(phase, kind, x1),
      opacity: trailOpacity((x0 + x1) / 2),
    }
  })
}

const buildHelix = (phase: number, visibleStartX: number): TrailSegment[] => {
  const visibleLength = BOX_LENGTH - visibleStartX
  if (visibleLength <= 0.0001) return []

  const segmentCount = Math.max(2, Math.ceil(110 * (visibleLength / BOX_LENGTH)))
  return Array.from({ length: segmentCount }, (_, index) => {
    const x0 = visibleStartX + (index / segmentCount) * visibleLength
    const x1 = visibleStartX + ((index + 1) / segmentCount) * visibleLength
    const r0 = phase - ((BOX_LENGTH - x0) / BOX_CYCLE_LENGTH) * TAU
    const r1 = phase - ((BOX_LENGTH - x1) / BOX_CYCLE_LENGTH) * TAU

    return {
      start: { x: x0, y: Math.cos(r0), z: Math.sin(r0) },
      end: { x: x1, y: Math.cos(r1), z: Math.sin(r1) },
      opacity: 0.2 * trailOpacity((x0 + x1) / 2),
    }
  })
}

const buildCircle = (): Vec3[] => {
  const steps = 120
  return Array.from({ length: steps + 1 }, (_, index) => {
    const radians = (index / steps) * TAU
    return { x: BOX_LENGTH, y: Math.cos(radians), z: Math.sin(radians) }
  })
}

const buildThetaTrail = (phase: number): TrailSegment[] => {
  const trailAngle = Math.min(Math.max(phase, 0), TAU)
  if (trailAngle <= 0.0001) return []

  const segmentCount = Math.max(2, Math.ceil(96 * (trailAngle / TAU)))
  const startAngle = phase - trailAngle
  return Array.from({ length: segmentCount }, (_, index) => {
    const a0 = startAngle + (index / segmentCount) * trailAngle
    const a1 = startAngle + ((index + 1) / segmentCount) * trailAngle
    const progress = (index + 1) / segmentCount
    return {
      start: { x: BOX_LENGTH, y: Math.cos(a0) * 0.36, z: Math.sin(a0) * 0.36 },
      end: { x: BOX_LENGTH, y: Math.cos(a1) * 0.36, z: Math.sin(a1) * 0.36 },
      opacity: 0.06 + 0.94 * Math.pow(progress, 2.15),
    }
  })
}

const clientToSvgPoint = (svg: SVGSVGElement, clientX: number, clientY: number): Point2 => {
  const rect = svg.getBoundingClientRect()
  if (rect.width <= 0 || rect.height <= 0) return { x: 0, y: 0 }
  return {
    x: ((clientX - rect.left) / rect.width) * VIEW_WIDTH,
    y: ((clientY - rect.top) / rect.height) * VIEW_HEIGHT,
  }
}

const chooseComponentHandle = (origin: Point2, endpoint: Point2) => {
  const dx = endpoint.x - origin.x
  const dy = endpoint.y - origin.y
  const length = Math.hypot(dx, dy)
  const midpoint = {
    x: (origin.x + endpoint.x) / 2,
    y: (origin.y + endpoint.y) / 2,
  }

  const basePerpendicular = length < 1
    ? { x: Math.SQRT1_2, y: -Math.SQRT1_2 }
    : { x: -dy / length, y: dx / length }

  const candidate = (sign: number) => ({
    x: midpoint.x + basePerpendicular.x * sign * 36,
    y: midpoint.y + basePerpendicular.y * sign * 36,
  })
  const score = (point: Point2) => Math.min(point.x, VIEW_WIDTH - point.x, point.y, VIEW_HEIGHT - point.y)
  const first = candidate(1)
  const second = candidate(-1)
  const sign = score(first) >= score(second) ? 1 : -1
  const direction = { x: basePerpendicular.x * sign, y: basePerpendicular.y * sign }

  return {
    midpoint,
    direction,
    base: {
      x: midpoint.x + direction.x * 36,
      y: midpoint.y + direction.y * 36,
    },
  }
}

const diamondPoints = (center: Point2, radius: number) => [
  `${center.x},${center.y - radius}`,
  `${center.x + radius},${center.y}`,
  `${center.x},${center.y + radius}`,
  `${center.x - radius},${center.y}`,
].join(' ')

export default function LabApp() {
  const [phase, setPhase] = useState(0)
  const [view, setView] = useState<ViewMode>('box')
  const [focusedMode, setFocusedMode] = useState<FlatView | null>(null)
  const [cameraState, setCameraState] = useState<CameraState>({ pose: BOX_CAMERA, isolation: 0 })
  const [transitioning, setTransitioning] = useState(false)
  const [concept, setConcept] = useState<LiveConcept>('trig')
  const [vectorProgress, setVectorProgress] = useState(0)
  const [vector, setVector] = useState<Point2>({ x: 1, y: 0 })
  const [componentProgress, setComponentProgress] = useState(0)
  const [componentPreview, setComponentPreview] = useState(0)
  const [conceptTransitioning, setConceptTransitioning] = useState(false)
  const cameraAnimationRef = useRef<number | null>(null)
  const conceptAnimationRef = useRef<number | null>(null)
  const gestureRef = useRef<Gesture | null>(null)
  const componentDragRef = useRef<ComponentDrag | null>(null)

  const normalizedAngle = normalizeRadians(phase)
  const values = trigValuesFromRadians(phase)
  const displayDegrees = radiansToDegrees(phase)
  const unitVector = { x: values.cos, y: values.sin }
  const displayVector = {
    x: lerp(unitVector.x, vector.x, vectorProgress),
    y: lerp(unitVector.y, vector.y, vectorProgress),
  }
  const vectorLength = vectorMagnitude(vector)
  const vectorRadians = vectorLength < 0.001 ? 0 : vectorAngle(vector)
  const vectorDegrees = radiansToDegrees(normalizeRadians(vectorRadians))

  const visibleDistance = Math.min(
    BOX_LENGTH,
    Math.max(0, (phase / TAU) * BOX_CYCLE_LENGTH),
  )
  const visibleStartX = BOX_LENGTH - visibleDistance

  const circleWorld = buildCircle()
  const thetaTrail = buildThetaTrail(phase)
  const helix = buildHelix(phase, visibleStartX)
  const sineSegments = buildWaveSegments(phase, 'sin', visibleStartX)
  const cosineSegments = buildWaveSegments(phase, 'cos', visibleStartX)

  const movingFront = endFace(visibleStartX)
  const far = endFace(BOX_LENGTH)
  const sinFace: Vec3[] = [movingFront[1], movingFront[2], far[2], far[1]]
  const cosFace: Vec3[] = [movingFront[0], movingFront[1], far[1], far[0]]

  const currentWorld: Vec3 = { x: BOX_LENGTH, y: displayVector.x, z: displayVector.y }
  const circleCenter: Vec3 = { x: BOX_LENGTH, y: 0, z: 0 }
  const sinCurrent: Vec3 = { x: BOX_LENGTH, y: FACE_EXTENT, z: values.sin }
  const cosCurrent: Vec3 = { x: BOX_LENGTH, y: values.cos, z: -FACE_EXTENT }
  const vectorXWorld: Vec3 = { x: BOX_LENGTH, y: displayVector.x, z: 0 }
  const thetaWorld: Vec3 = {
    x: BOX_LENGTH,
    y: Math.cos(normalizedAngle / 2) * 0.52,
    z: Math.sin(normalizedAngle / 2) * 0.52,
  }

  const xAxisStart: Vec3 = { x: BOX_LENGTH, y: -1.03, z: 0 }
  const xAxisEnd: Vec3 = { x: BOX_LENGTH, y: 1.03, z: 0 }
  const yAxisStart: Vec3 = { x: BOX_LENGTH, y: 0, z: -1.03 }
  const yAxisEnd: Vec3 = { x: BOX_LENGTH, y: 0, z: 1.03 }

  useEffect(() => {
    if (concept !== 'trig' || conceptTransitioning) return undefined

    let frame = 0
    let last = performance.now()
    const tick = (now: number) => {
      const deltaSeconds = Math.min((now - last) / 1000, 0.05)
      last = now
      setPhase((current) => current + deltaSeconds * PLAYBACK_SPEED)
      frame = requestAnimationFrame(tick)
    }

    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [concept, conceptTransitioning])

  useEffect(() => () => {
    if (cameraAnimationRef.current !== null) cancelAnimationFrame(cameraAnimationRef.current)
    if (conceptAnimationRef.current !== null) cancelAnimationFrame(conceptAnimationRef.current)
  }, [])

  const animateCamera = (targetView: ViewMode) => {
    if (transitioning || conceptTransitioning || concept !== 'trig') return

    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const targetPose = targetView === 'box' ? BOX_CAMERA : VIEW_CAMERAS[targetView]
    const targetIsolation = targetView === 'box' ? 0 : 1
    const nextFocus: FlatView | null = targetView === 'box' ? null : targetView

    if (reducedMotion) {
      setCameraState({ pose: targetPose, isolation: targetIsolation })
      setFocusedMode(nextFocus)
      setView(targetView)
      return
    }

    if (targetView !== 'box') setFocusedMode(targetView)
    setTransitioning(true)
    const from = cameraState
    const startedAt = performance.now()

    const tick = (now: number) => {
      const raw = Math.min(1, (now - startedAt) / CAMERA_TRANSITION_MS)
      const eased = smootherStep(raw)
      setCameraState({
        pose: lerpCamera(from.pose, targetPose, eased),
        isolation: lerp(from.isolation, targetIsolation, eased),
      })

      if (raw < 1) {
        cameraAnimationRef.current = requestAnimationFrame(tick)
        return
      }

      cameraAnimationRef.current = null
      setView(targetView)
      setFocusedMode(nextFocus)
      setTransitioning(false)
    }

    cameraAnimationRef.current = requestAnimationFrame(tick)
  }

  const animateVectorConcept = (target: Extract<LiveConcept, 'trig' | 'vector'>) => {
    if (view !== 'circle' || transitioning || conceptTransitioning) return

    if (target === 'vector') {
      setVector({ x: values.cos, y: values.sin })
      setComponentProgress(0)
      setComponentPreview(0)
    } else if (vectorLength >= 0.001) {
      setPhase((current) => unwrapAngleNear(current, vectorRadians))
    }

    const targetProgress = target === 'vector' ? 1 : 0
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches

    if (reducedMotion) {
      setVectorProgress(targetProgress)
      setConcept(target)
      return
    }

    if (target === 'vector') setConcept('vector')
    setConceptTransitioning(true)
    const fromProgress = vectorProgress
    const startedAt = performance.now()

    const tick = (now: number) => {
      const raw = Math.min(1, (now - startedAt) / CONCEPT_TRANSITION_MS)
      setVectorProgress(lerp(fromProgress, targetProgress, smootherStep(raw)))

      if (raw < 1) {
        conceptAnimationRef.current = requestAnimationFrame(tick)
        return
      }

      conceptAnimationRef.current = null
      setVectorProgress(targetProgress)
      setConcept(target)
      setConceptTransitioning(false)
    }

    conceptAnimationRef.current = requestAnimationFrame(tick)
  }

  const animateComponents = (target: Extract<LiveConcept, 'vector' | 'vector-components'>) => {
    if (view !== 'circle' || conceptTransitioning || transitioning || concept === 'trig') return

    const targetProgress = target === 'vector-components' ? 1 : 0
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    setComponentPreview(0)

    if (reducedMotion) {
      setComponentProgress(targetProgress)
      setConcept(target)
      return
    }

    if (target === 'vector-components') setConcept('vector-components')
    setConceptTransitioning(true)
    const fromProgress = componentProgress
    const startedAt = performance.now()

    const tick = (now: number) => {
      const raw = Math.min(1, (now - startedAt) / COMPONENT_TRANSITION_MS)
      setComponentProgress(lerp(fromProgress, targetProgress, smootherStep(raw)))

      if (raw < 1) {
        conceptAnimationRef.current = requestAnimationFrame(tick)
        return
      }

      conceptAnimationRef.current = null
      setComponentProgress(targetProgress)
      setConcept(target)
      setConceptTransitioning(false)
    }

    conceptAnimationRef.current = requestAnimationFrame(tick)
  }

  const openFace = (mode: FlatView) => {
    if (view !== 'box' || transitioning || concept !== 'trig') return
    animateCamera(mode)
  }

  const returnToBox = () => {
    if (view === 'box' || transitioning || conceptTransitioning || concept !== 'trig') return
    animateCamera('box')
  }

  const camera = cameraState.pose
  const isolation = cameraState.isolation
  const otherOpacity = 1 - isolation * 0.96
  const edgeOpacity = 1 - isolation * 0.94
  const targetSurfaceOpacity = 0.08 + isolation * 0.08
  const circleOpacity = focusedMode && focusedMode !== 'circle' ? otherOpacity : 1
  const sinOpacity = focusedMode && focusedMode !== 'sin' ? otherOpacity : 1
  const cosOpacity = focusedMode && focusedMode !== 'cos' ? otherOpacity : 1
  const helixOpacity = focusedMode ? otherOpacity : 1
  const guideOpacity = (focusedMode === 'circle' ? 1 : otherOpacity) * (1 - vectorProgress)

  const projectedCurrent = projectPoint(currentWorld, camera)
  const projectedTheta = projectPoint(thetaWorld, camera)
  const projectedCircleCenter = projectPoint(circleCenter, camera)
  const projectedSin = projectPoint(sinCurrent, camera)
  const projectedCos = projectPoint(cosCurrent, camera)
  const projectedVectorX = projectPoint(vectorXWorld, camera)
  const projectedVectorBasisX = projectPoint({ x: BOX_LENGTH, y: 1, z: 0 }, camera)
  const projectedVectorBasisY = projectPoint({ x: BOX_LENGTH, y: 0, z: 1 }, camera)
  const componentVisualProgress = Math.max(componentProgress, componentPreview)
  const handleGeometry = chooseComponentHandle(projectedCircleCenter, projectedCurrent)
  const componentHandle = {
    x: handleGeometry.base.x + handleGeometry.direction.x * componentPreview * 34,
    y: handleGeometry.base.y + handleGeometry.direction.y * componentPreview * 34,
  }

  const updateVectorFromClient = (svg: SVGSVGElement, clientX: number, clientY: number) => {
    const screenPoint = clientToSvgPoint(svg, clientX, clientY)
    const next = screenPointToVector(
      screenPoint,
      projectedCircleCenter,
      projectedVectorBasisX,
      projectedVectorBasisY,
    )
    setVector(clampVectorMagnitude(next, VECTOR_MAX_MAGNITUDE))
    setComponentPreview(0)
  }

  const handleVectorPointerDown = (event: ReactPointerEvent<SVGCircleElement>) => {
    if (conceptTransitioning || concept === 'trig') return
    event.stopPropagation()
    event.currentTarget.setPointerCapture(event.pointerId)
  }

  const handleVectorPointerMove = (event: ReactPointerEvent<SVGCircleElement>) => {
    if (!event.currentTarget.hasPointerCapture(event.pointerId) || conceptTransitioning) return
    event.stopPropagation()
    const svg = event.currentTarget.ownerSVGElement
    if (svg) updateVectorFromClient(svg, event.clientX, event.clientY)
  }

  const handleVectorPointerUp = (event: ReactPointerEvent<SVGCircleElement>) => {
    event.stopPropagation()
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId)
    }
  }

  const handleVectorKeyDown = (event: ReactKeyboardEvent<SVGCircleElement>) => {
    const step = event.shiftKey ? 0.16 : 0.07
    const delta = event.key === 'ArrowLeft'
      ? { x: -step, y: 0 }
      : event.key === 'ArrowRight'
        ? { x: step, y: 0 }
        : event.key === 'ArrowUp'
          ? { x: 0, y: step }
          : event.key === 'ArrowDown'
            ? { x: 0, y: -step }
            : null

    if (!delta) return
    event.preventDefault()
    event.stopPropagation()
    setVector((current) => clampVectorMagnitude({
      x: current.x + delta.x,
      y: current.y + delta.y,
    }))
  }

  const handleComponentPointerDown = (event: ReactPointerEvent<SVGPolygonElement>) => {
    if (concept !== 'vector' || conceptTransitioning) return
    event.stopPropagation()
    const svg = event.currentTarget.ownerSVGElement
    if (!svg) return

    componentDragRef.current = {
      pointerId: event.pointerId,
      start: clientToSvgPoint(svg, event.clientX, event.clientY),
      direction: handleGeometry.direction,
    }
    event.currentTarget.setPointerCapture(event.pointerId)
  }

  const handleComponentPointerMove = (event: ReactPointerEvent<SVGPolygonElement>) => {
    const drag = componentDragRef.current
    if (!drag || drag.pointerId !== event.pointerId || conceptTransitioning) return
    event.stopPropagation()
    const svg = event.currentTarget.ownerSVGElement
    if (!svg) return

    const point = clientToSvgPoint(svg, event.clientX, event.clientY)
    setComponentPreview(componentPullProgress(drag.start, point, drag.direction))
  }

  const handleComponentPointerUp = (event: ReactPointerEvent<SVGPolygonElement>) => {
    const drag = componentDragRef.current
    componentDragRef.current = null
    event.stopPropagation()

    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId)
    }
    if (!drag || drag.pointerId !== event.pointerId || conceptTransitioning) {
      setComponentPreview(0)
      return
    }

    const svg = event.currentTarget.ownerSVGElement
    if (!svg) {
      setComponentPreview(0)
      return
    }
    const point = clientToSvgPoint(svg, event.clientX, event.clientY)
    if (isComponentGatewayGesture(drag.start, point, drag.direction)) {
      animateComponents('vector-components')
    } else {
      setComponentPreview(0)
    }
  }

  const handleScenePointerDown = (event: ReactPointerEvent<SVGSVGElement>) => {
    if (view === 'box' || transitioning || conceptTransitioning) return
    gestureRef.current = {
      clientX: event.clientX,
      clientY: event.clientY,
      pointerId: event.pointerId,
      svgPoint: clientToSvgPoint(event.currentTarget, event.clientX, event.clientY),
    }
    event.currentTarget.setPointerCapture(event.pointerId)
  }

  const handleScenePointerUp = (event: ReactPointerEvent<SVGSVGElement>) => {
    const gesture = gestureRef.current
    gestureRef.current = null
    if (!gesture || transitioning || conceptTransitioning || view === 'box') return

    if (event.currentTarget.hasPointerCapture(gesture.pointerId)) {
      event.currentTarget.releasePointerCapture(gesture.pointerId)
    }

    const endSvg = clientToSvgPoint(event.currentTarget, event.clientX, event.clientY)
    if (
      view === 'circle'
      && concept === 'trig'
      && isVectorGatewayGesture(gesture.svgPoint, endSvg, projectedCircleCenter)
    ) {
      animateVectorConcept('vector')
      return
    }

    const dx = event.clientX - gesture.clientX
    const dy = event.clientY - gesture.clientY
    const distance = Math.hypot(dx, dy)

    if (concept === 'vector-components') {
      if (distance < 14) animateComponents('vector')
      return
    }
    if (concept === 'vector') {
      if (distance < 14) animateVectorConcept('trig')
      return
    }

    if (distance < 14 || Math.abs(dx) > 42 || Math.abs(dy) > 42) returnToBox()
  }

  const handleFocusedKeyDown = (event: ReactKeyboardEvent<SVGSVGElement>) => {
    if (event.key !== 'Enter' && event.key !== ' ') return
    if (view === 'box') return

    event.preventDefault()
    if (concept === 'vector-components') {
      animateComponents('vector')
      return
    }
    if (concept === 'vector') {
      animateVectorConcept('trig')
      return
    }
    returnToBox()
  }

  const resetCurrentModel = () => {
    setComponentPreview(0)
    if (concept === 'trig') {
      setPhase(0)
      return
    }
    setVector({ x: 1, y: 0 })
    setPhase((current) => unwrapAngleNear(current, 0))
  }

  const modeLabel = concept === 'trig'
    ? focusedMode?.toUpperCase() ?? 'BOX'
    : conceptLabel(concept)

  return (
    <main className="app">
      <header className="topbar">
        <div className="brand">MATH LAB</div>
        {concept === 'trig' ? (
          <div className="live-readout" aria-live="polite">
            <strong>{displayDegrees.toFixed(displayDegrees < 1000 ? 0 : 1)}°</strong>
            <span className="mini-value sin-mini">sin {values.sin.toFixed(3)}</span>
            <span className="mini-value cos-mini">cos {values.cos.toFixed(3)}</span>
            <small>{phase.toFixed(2)} rad</small>
          </div>
        ) : (
          <div className="live-readout vector-readout" aria-live="polite">
            <strong>{vectorDegrees.toFixed(0)}°</strong>
            <span className="mini-value cos-mini">x {vectorComponentLabel(vector.x)}</span>
            <span className="mini-value sin-mini">y {vectorComponentLabel(vector.y)}</span>
            <small>r {vectorLength.toFixed(2)}</small>
          </div>
        )}
      </header>

      <section className="panel model-card">
        <div className="model-toolbar">
          <span className="model-mode">{modeLabel}</span>
          {view === 'circle' && concept === 'trig' && !conceptTransitioning && (
            <span className="gateway-whisper" aria-hidden="true">origin ↗</span>
          )}
          {concept === 'vector' && !conceptTransitioning && (
            <span className="gateway-whisper component-whisper" aria-hidden="true">◇ pull apart</span>
          )}
          {concept === 'vector-components' && !conceptTransitioning && (
            <span className="gateway-whisper" aria-hidden="true">tap background ↩</span>
          )}
        </div>

        <div className="model-stage">
          <svg
            className={`camera-svg ${view === 'box' ? 'is-box-view' : 'is-focus-view'} ${concept === 'vector' ? 'is-vector-room' : ''} ${concept === 'vector-components' ? 'is-components-room' : ''}`}
            viewBox={`0 0 ${VIEW_WIDTH} ${VIEW_HEIGHT}`}
            role={view === 'box' ? 'img' : 'button'}
            tabIndex={view === 'box' ? undefined : 0}
            aria-label={view === 'box'
              ? '円運動とサイン・コサインの3D投影モデル'
              : concept === 'vector-components'
                ? 'ベクトルをx成分とy成分に分解。ベクトル先端はドラッグ可能。背景タップでベクトル表示に戻る'
                : concept === 'vector'
                  ? 'ベクトル表示。白い先端をドラッグ。菱形ハンドルを外へ引くと成分分解へ進む。背景タップで単位円に戻る'
                  : `${focusedMode === 'circle' ? '単位円' : focusedMode === 'sin' ? 'サイン' : 'コサイン'}を正面から表示。単位円では原点から外へスワイプするとベクトルに遷移する`}
            onPointerDown={handleScenePointerDown}
            onPointerUp={handleScenePointerUp}
            onPointerCancel={() => { gestureRef.current = null }}
            onKeyDown={handleFocusedKeyDown}
          >
            <defs>
              <marker id="vector-arrow" markerWidth="10" markerHeight="10" refX="8" refY="5" orient="auto" markerUnits="strokeWidth">
                <path d="M 0 0 L 10 5 L 0 10 z" className="vector-arrowhead" />
              </marker>
            </defs>

            <polygon
              points={pointsString(sinFace, camera)}
              className="box-face box-face-sin"
              style={{ opacity: focusedMode === 'sin' ? targetSurfaceOpacity : 0.025 * otherOpacity }}
            />

            <g className="box-wave-trail" style={{ opacity: 0.82 * sinOpacity }}>
              {sineSegments.map((segment, index) => {
                const start = projectPoint(segment.start, camera)
                const end = projectPoint(segment.end, camera)
                return <line key={index} x1={start.x} y1={start.y} x2={end.x} y2={end.y} className="box-wave box-wave-sin" style={{ opacity: segment.opacity }} />
              })}
            </g>

            <polygon points={pointsString(movingFront, camera)} className="box-face box-face-near" style={{ opacity: 0.018 * otherOpacity }} />
            <polygon
              points={pointsString(cosFace, camera)}
              className="box-face box-face-cos"
              style={{ opacity: focusedMode === 'cos' ? targetSurfaceOpacity : 0.045 * otherOpacity }}
            />
            <polygon
              points={pointsString(far, camera)}
              className="box-face box-face-circle"
              style={{ opacity: focusedMode === 'circle' ? targetSurfaceOpacity : 0.025 * circleOpacity }}
            />

            <g className="box-edges" style={{ opacity: edgeOpacity }}>
              {visibleDistance > 0.015 && (
                <polyline points={`${pointsString(movingFront, camera)} ${pointString(projectPoint(movingFront[0], camera))}`} />
              )}
              <polyline points={`${pointsString(far, camera)} ${pointString(projectPoint(far[0], camera))}`} />
              {visibleDistance > 0.015 && movingFront.map((point, index) => {
                const start = projectPoint(point, camera)
                const end = projectPoint(far[index], camera)
                return <line key={index} x1={start.x} y1={start.y} x2={end.x} y2={end.y} />
              })}
            </g>

            <g className="box-wave-trail" style={{ opacity: 0.92 * cosOpacity }}>
              {cosineSegments.map((segment, index) => {
                const start = projectPoint(segment.start, camera)
                const end = projectPoint(segment.end, camera)
                return <line key={index} x1={start.x} y1={start.y} x2={end.x} y2={end.y} className="box-wave box-wave-cos" style={{ opacity: segment.opacity }} />
              })}
            </g>

            <g className="box-helix-fade" style={{ opacity: helixOpacity }} aria-hidden="true">
              {helix.map((segment, index) => {
                const start = projectPoint(segment.start, camera)
                const end = projectPoint(segment.end, camera)
                return <line key={index} x1={start.x} y1={start.y} x2={end.x} y2={end.y} className="box-helix-segment" style={{ opacity: segment.opacity }} />
              })}
            </g>

            <g className="vector-world" style={{ opacity: vectorProgress }} aria-hidden={vectorProgress < 0.05}>
              {VECTOR_GRID_VALUES.map((value) => {
                const verticalStart = projectPoint({ x: BOX_LENGTH, y: value, z: -VECTOR_GRID_EXTENT }, camera)
                const verticalEnd = projectPoint({ x: BOX_LENGTH, y: value, z: VECTOR_GRID_EXTENT }, camera)
                const horizontalStart = projectPoint({ x: BOX_LENGTH, y: -VECTOR_GRID_EXTENT, z: value }, camera)
                const horizontalEnd = projectPoint({ x: BOX_LENGTH, y: VECTOR_GRID_EXTENT, z: value }, camera)
                return (
                  <g key={value} className={value === 0 ? 'vector-grid-axis' : 'vector-grid-line'}>
                    <line x1={verticalStart.x} y1={verticalStart.y} x2={verticalEnd.x} y2={verticalEnd.y} />
                    <line x1={horizontalStart.x} y1={horizontalStart.y} x2={horizontalEnd.x} y2={horizontalEnd.y} />
                  </g>
                )
              })}
            </g>

            <g className="circle-plane-details" style={{ opacity: circleOpacity }}>
              {(() => {
                const xStart = projectPoint(xAxisStart, camera)
                const xEnd = projectPoint(xAxisEnd, camera)
                const yStart = projectPoint(yAxisStart, camera)
                const yEnd = projectPoint(yAxisEnd, camera)
                return (
                  <g className="box-circle-axes" style={{ opacity: 1 - vectorProgress * 0.72 }}>
                    <line x1={xStart.x} y1={xStart.y} x2={xEnd.x} y2={xEnd.y} />
                    <line x1={yStart.x} y1={yStart.y} x2={yEnd.x} y2={yEnd.y} />
                  </g>
                )
              })()}
              <path d={pathFromWorldPoints(circleWorld, camera)} className="box-circle" style={{ opacity: 1 - vectorProgress * 0.94 }} />
              {thetaTrail.map((segment, index) => {
                const start = projectPoint(segment.start, camera)
                const end = projectPoint(segment.end, camera)
                return <line key={index} x1={start.x} y1={start.y} x2={end.x} y2={end.y} className="box-angle-arc" style={{ opacity: segment.opacity * (1 - vectorProgress), strokeWidth: 3.6 }} />
              })}
              <line
                x1={projectedCircleCenter.x}
                y1={projectedCircleCenter.y}
                x2={projectedCurrent.x}
                y2={projectedCurrent.y}
                className="box-radius vector-radius"
                markerEnd={vectorProgress > 0.04 ? 'url(#vector-arrow)' : undefined}
                style={{ strokeWidth: 2.25 + vectorProgress * 1.25 }}
              />
              <text x={projectedTheta.x + 5} y={projectedTheta.y - 5} className="box-theta" style={{ opacity: 1 - vectorProgress }}>θ</text>
              <circle cx={projectedCurrent.x} cy={projectedCurrent.y} r={6 + vectorProgress * 0.8} className="box-current" />
            </g>

            <g className="vector-coordinate-info" style={{ opacity: vectorProgress }} pointerEvents="none">
              <text x={projectedCurrent.x + 15} y={projectedCurrent.y - 15} className="vector-value-label">
                ({vectorComponentLabel(vector.x)}, {vectorComponentLabel(vector.y)})
              </text>
              <text x={projectedCurrent.x + 15} y={projectedCurrent.y + 3} className="vector-magnitude-label">
                r = {vectorLength.toFixed(2)}
              </text>
            </g>

            <g className="vector-components" style={{ opacity: vectorProgress * componentVisualProgress }} pointerEvents="none">
              <line x1={projectedCircleCenter.x} y1={projectedCircleCenter.y} x2={projectedVectorX.x} y2={projectedVectorX.y} className="vector-component vector-component-x" />
              <line x1={projectedVectorX.x} y1={projectedVectorX.y} x2={projectedCurrent.x} y2={projectedCurrent.y} className="vector-component vector-component-y" />
              <circle cx={projectedVectorX.x} cy={projectedVectorX.y} r="4" className="component-elbow" />
              <text x={(projectedCircleCenter.x + projectedVectorX.x) / 2} y={(projectedCircleCenter.y + projectedVectorX.y) / 2 + 21} className="vector-component-label vector-component-label-x">
                x = r cos θ = {vectorComponentLabel(vector.x)}
              </text>
              <text x={(projectedVectorX.x + projectedCurrent.x) / 2 + 12} y={(projectedVectorX.y + projectedCurrent.y) / 2} className="vector-component-label vector-component-label-y">
                y = r sin θ = {vectorComponentLabel(vector.y)}
              </text>
            </g>

            {concept === 'vector-components' && !conceptTransitioning && (
              <g className="component-equations" pointerEvents="none">
                <text x="28" y="360">x = r cos θ</text>
                <text x="28" y="383">y = r sin θ</text>
              </g>
            )}

            <g className="projection-guides" style={{ opacity: guideOpacity }}>
              <line x1={projectedCurrent.x} y1={projectedCurrent.y} x2={projectedSin.x} y2={projectedSin.y} className="box-guide box-guide-sin" />
              <line x1={projectedCurrent.x} y1={projectedCurrent.y} x2={projectedCos.x} y2={projectedCos.y} className="box-guide box-guide-cos" />
              <circle cx={projectedSin.x} cy={projectedSin.y} r="4.5" className="box-dot box-dot-sin" />
              <circle cx={projectedCos.x} cy={projectedCos.y} r="4.5" className="box-dot box-dot-cos" />
              <text x={projectedSin.x + 9} y={projectedSin.y - 7} className="circle-projection-label circle-projection-label-sin">sin</text>
              <text x={projectedCos.x + 9} y={projectedCos.y + 17} className="circle-projection-label circle-projection-label-cos">cos</text>
            </g>

            {concept === 'vector' && vectorProgress > 0.98 && !conceptTransitioning && (
              <g className="component-gateway">
                <line
                  x1={handleGeometry.midpoint.x}
                  y1={handleGeometry.midpoint.y}
                  x2={componentHandle.x}
                  y2={componentHandle.y}
                  className="component-gateway-tether"
                  pointerEvents="none"
                />
                <polygon
                  points={diamondPoints(componentHandle, 11)}
                  className="component-gateway-handle"
                  role="button"
                  tabIndex={0}
                  aria-label="この菱形を外側へ引いてベクトルをx成分とy成分に分解する"
                  onPointerDown={handleComponentPointerDown}
                  onPointerMove={handleComponentPointerMove}
                  onPointerUp={handleComponentPointerUp}
                  onPointerCancel={(event) => {
                    event.stopPropagation()
                    componentDragRef.current = null
                    setComponentPreview(0)
                  }}
                  onKeyDown={(event) => {
                    event.stopPropagation()
                    if (event.key === 'Enter' || event.key === ' ') {
                      event.preventDefault()
                      animateComponents('vector-components')
                    }
                  }}
                />
                <text x={componentHandle.x + 14} y={componentHandle.y - 12} className="component-gateway-label" pointerEvents="none">PULL</text>
              </g>
            )}

            {(concept === 'vector' || concept === 'vector-components') && vectorProgress > 0.98 && !conceptTransitioning && (
              <g className="vector-endpoint-control">
                <circle cx={projectedCurrent.x} cy={projectedCurrent.y} r="11" className="vector-endpoint-ring" pointerEvents="none" />
                <circle
                  cx={projectedCurrent.x}
                  cy={projectedCurrent.y}
                  r="27"
                  className="vector-endpoint-hit"
                  role="slider"
                  tabIndex={0}
                  aria-label="ベクトルの先端。ドラッグして向きと長さを変更"
                  aria-valuetext={`x ${vectorComponentLabel(vector.x)}, y ${vectorComponentLabel(vector.y)}, r ${vectorLength.toFixed(2)}`}
                  onPointerDown={handleVectorPointerDown}
                  onPointerMove={handleVectorPointerMove}
                  onPointerUp={handleVectorPointerUp}
                  onPointerCancel={(event) => {
                    event.stopPropagation()
                    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId)
                  }}
                  onKeyDown={handleVectorKeyDown}
                />
              </g>
            )}

            {view === 'circle' && concept === 'trig' && !transitioning && !conceptTransitioning && (
              <circle
                cx={projectedCircleCenter.x}
                cy={projectedCircleCenter.y}
                r="18"
                className="vector-gateway-origin"
                role="button"
                tabIndex={0}
                aria-label="原点から外へスワイプしてベクトル表示へ進む"
                onClick={(event) => event.stopPropagation()}
                onKeyDown={(event) => {
                  event.stopPropagation()
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault()
                    animateVectorConcept('vector')
                  }
                }}
              />
            )}

            {view === 'box' && !transitioning && concept === 'trig' && (
              <g className="face-hits">
                <polygon
                  points={pointsString(sinFace, camera)}
                  className="face-hit face-hit-sin"
                  role="button"
                  tabIndex={0}
                  aria-label="サイン面を正面から見る"
                  onClick={(event) => { event.stopPropagation(); openFace('sin') }}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); openFace('sin') }
                  }}
                />
                <polygon
                  points={pointsString(cosFace, camera)}
                  className="face-hit face-hit-cos"
                  role="button"
                  tabIndex={0}
                  aria-label="コサイン面を正面から見る"
                  onClick={(event) => { event.stopPropagation(); openFace('cos') }}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); openFace('cos') }
                  }}
                />
                <polygon
                  points={pointsString(far, camera)}
                  className="face-hit face-hit-circle"
                  role="button"
                  tabIndex={0}
                  aria-label="単位円を正面から見る"
                  onClick={(event) => { event.stopPropagation(); openFace('circle') }}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); openFace('circle') }
                  }}
                />
              </g>
            )}
          </svg>
        </div>
      </section>

      <button
        className="floating-reset"
        type="button"
        onClick={resetCurrentModel}
        aria-label={concept === 'trig' ? '0度に戻す' : 'ベクトルを(1, 0)に戻す'}
        title={concept === 'trig' ? '0°に戻す' : 'vector reset'}
      >
        <span aria-hidden="true">↺</span>
      </button>
    </main>
  )
}
