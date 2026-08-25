import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type PointerEvent as ReactPointerEvent,
} from 'react'
import { createPortal } from 'react-dom'
import { markConceptDiscovered } from './discoveryState'
import {
  applyMatrix,
  determinantFlipProgress,
  determinantOrientation,
  determinantTargetProgress,
  directionMatchProgress,
  EIGENBASIS_SETTLE_MS,
  EIGEN_SECOND_DWELL_MS,
  EIGENVECTOR_DWELL_MS,
  eigenDirectionProgress,
  isDeterminantCollapseTarget,
  isDeterminantFlipReady,
  isDirectionMatchHit,
  isEigenDirectionHit,
  matrixDeterminant,
  MATRIX_FLIP_DWELL_MS,
  MATRIX_SINGULAR_DWELL_MS,
  nearestCollinearVector,
  nearestEigenPair,
  nearestLineDirection,
  realEigenPairs,
  remainingEigenPair,
  type EigenPair,
} from './matrixModel'
import {
  clampVectorMagnitude,
  screenPointToVector,
  targetDwellProgress,
  vectorComponentLabel,
  type Point2,
} from './vectorModel'

const VIEW_WIDTH = 760
const VIEW_HEIGHT = 430
const BASIS_MAX_MAGNITUDE = 1.65
const PROBE_MAGNITUDE = 0.9

type Mode =
  | 'basis'
  | 'matrix'
  | 'determinant'
  | 'eigen-hunt'
  | 'eigen-second-hunt'
  | 'eigenbasis'
  | 'diagonalization'
type AxisName = 'a' | 'b'

type MatrixContext = {
  svg: SVGSVGElement
  card: HTMLElement
  toolbar: HTMLElement | null
  dock: HTMLElement | null
  reset: HTMLElement | null
  origin: Point2
  xBasisPoint: Point2
  yBasisPoint: Point2
  initialA: Point2
  initialB: Point2
}

const numberAttr = (element: Element, name: string) => Number(element.getAttribute(name) ?? 0)
const magnitude = (value: Point2) => Math.hypot(value.x, value.y)
const normalizeTo = (value: Point2, length: number): Point2 => {
  const size = magnitude(value)
  return size < 1e-8 ? { x: length, y: 0 } : { x: value.x / size * length, y: value.y / size * length }
}
const rotate = (value: Point2, radians: number): Point2 => ({
  x: value.x * Math.cos(radians) - value.y * Math.sin(radians),
  y: value.x * Math.sin(radians) + value.y * Math.cos(radians),
})
const combine = (a: Point2, aScale: number, b: Point2, bScale: number): Point2 => ({
  x: a.x * aScale + b.x * bScale,
  y: a.y * aScale + b.y * bScale,
})
const isEigenMode = (mode: Mode) => mode === 'eigen-hunt'
  || mode === 'eigen-second-hunt'
  || mode === 'eigenbasis'
  || mode === 'diagonalization'
const isProbeMode = (mode: Mode) => mode === 'eigen-hunt' || mode === 'eigen-second-hunt'

const readContext = (): MatrixContext | null => {
  const card = document.querySelector<HTMLElement>('.model-card.orthogonal-basis-active')
  const svg = card?.querySelector<SVGSVGElement>('.camera-svg.is-components-room')
  if (!card || !svg) return null

  const basisA = svg.querySelector<SVGLineElement>('.orthogonal-basis-vector.basis-vector-a')
  const basisB = svg.querySelector<SVGLineElement>('.orthogonal-basis-vector.basis-vector-b')
  const axisLines = svg.querySelectorAll<SVGLineElement>('.vector-grid-axis line')
  if (!basisA || !basisB || axisLines.length < 2) return null

  const yAxis = axisLines[0]
  const xAxis = axisLines[1]
  const yStart = { x: numberAttr(yAxis, 'x1'), y: numberAttr(yAxis, 'y1') }
  const yEnd = { x: numberAttr(yAxis, 'x2'), y: numberAttr(yAxis, 'y2') }
  const xStart = { x: numberAttr(xAxis, 'x1'), y: numberAttr(xAxis, 'y1') }
  const xEnd = { x: numberAttr(xAxis, 'x2'), y: numberAttr(xAxis, 'y2') }
  const origin = {
    x: (xStart.x + xEnd.x) / 2,
    y: (yStart.y + yEnd.y) / 2,
  }
  const xBasisPoint = {
    x: origin.x + (xEnd.x - xStart.x) / 3,
    y: origin.y + (xEnd.y - xStart.y) / 3,
  }
  const yBasisPoint = {
    x: origin.x + (yEnd.x - yStart.x) / 3,
    y: origin.y + (yEnd.y - yStart.y) / 3,
  }
  const aPoint = { x: numberAttr(basisA, 'x2'), y: numberAttr(basisA, 'y2') }
  const bPoint = { x: numberAttr(basisB, 'x2'), y: numberAttr(basisB, 'y2') }

  return {
    svg,
    card,
    toolbar: document.querySelector<HTMLElement>('.model-toolbar'),
    dock: document.querySelector<HTMLElement>('.topbar'),
    reset: document.querySelector<HTMLElement>('.floating-reset'),
    origin,
    xBasisPoint,
    yBasisPoint,
    initialA: screenPointToVector(aPoint, origin, xBasisPoint, yBasisPoint),
    initialB: screenPointToVector(bPoint, origin, xBasisPoint, yBasisPoint),
  }
}

const sameContext = (a: MatrixContext | null, b: MatrixContext | null) =>
  a?.svg === b?.svg && a?.card === b?.card

const vectorToScreen = (vector: Point2, context: MatrixContext): Point2 => {
  const xBasis = {
    x: context.xBasisPoint.x - context.origin.x,
    y: context.xBasisPoint.y - context.origin.y,
  }
  const yBasis = {
    x: context.yBasisPoint.x - context.origin.x,
    y: context.yBasisPoint.y - context.origin.y,
  }
  return {
    x: context.origin.x + vector.x * xBasis.x + vector.y * yBasis.x,
    y: context.origin.y + vector.x * xBasis.y + vector.y * yBasis.y,
  }
}

const addBasisScreen = (
  context: MatrixContext,
  a: Point2,
  aScale: number,
  b: Point2,
  bScale: number,
): Point2 => vectorToScreen(combine(a, aScale, b, bScale), context)

const clientToVector = (
  svg: SVGSVGElement,
  context: MatrixContext,
  clientX: number,
  clientY: number,
) => {
  const rect = svg.getBoundingClientRect()
  if (rect.width <= 0 || rect.height <= 0) return { x: 0, y: 0 }
  const point = {
    x: ((clientX - rect.left) / rect.width) * VIEW_WIDTH,
    y: ((clientY - rect.top) / rect.height) * VIEW_HEIGHT,
  }
  return screenPointToVector(point, context.origin, context.xBasisPoint, context.yBasisPoint)
}

const axisFromElement = (element: SVGCircleElement): AxisName =>
  element.dataset.axis === 'a' ? 'a' : 'b'

export default function MatrixDeterminantPortal() {
  const [context, setContext] = useState<MatrixContext | null>(null)
  const [mode, setMode] = useState<Mode>('basis')
  const [basisA, setBasisA] = useState<Point2>({ x: 1, y: 0 })
  const [basisB, setBasisB] = useState<Point2>({ x: 0, y: 1 })
  const [collapseDwell, setCollapseDwell] = useState(0)
  const [flipDwell, setFlipDwell] = useState(0)
  const [eigenDwell, setEigenDwell] = useState(0)
  const [preCollapse, setPreCollapse] = useState<{ a: Point2; b: Point2 } | null>(null)
  const [probe, setProbe] = useState<Point2>({ x: PROBE_MAGNITUDE, y: 0 })
  const [lockedEigenOne, setLockedEigenOne] = useState<EigenPair | null>(null)
  const [lockedEigenTwo, setLockedEigenTwo] = useState<EigenPair | null>(null)
  const contextRef = useRef<MatrixContext | null>(null)
  const basisARef = useRef<Point2>(basisA)
  const basisBRef = useRef<Point2>(basisB)
  const probeRef = useRef<Point2>(probe)
  const lastMovedRef = useRef<AxisName>('b')

  useEffect(() => {
    let frame = 0
    const refresh = () => {
      cancelAnimationFrame(frame)
      frame = requestAnimationFrame(() => {
        const next = readContext()
        if (sameContext(contextRef.current, next)) return
        contextRef.current = next
        setContext(next)
        setMode('basis')
        setCollapseDwell(0)
        setFlipDwell(0)
        setEigenDwell(0)
        setPreCollapse(null)
        setLockedEigenOne(null)
        setLockedEigenTwo(null)
        if (next) {
          basisARef.current = next.initialA
          basisBRef.current = next.initialB
          setBasisA(next.initialA)
          setBasisB(next.initialB)
        }
      })
    }

    refresh()
    const observer = new MutationObserver(refresh)
    observer.observe(document.body, {
      subtree: true,
      childList: true,
      attributes: true,
      attributeFilter: ['class'],
    })

    return () => {
      observer.disconnect()
      cancelAnimationFrame(frame)
    }
  }, [])

  const determinant = matrixDeterminant(basisA, basisB)
  const collapseProgress = determinantTargetProgress(basisA, basisB)
  const collapseHit = mode === 'matrix' && isDeterminantCollapseTarget(basisA, basisB)
  const orientation = determinantOrientation(determinant)
  const flipProgress = mode === 'determinant' ? determinantFlipProgress(determinant) : 0
  const flipReady = mode === 'determinant' && isDeterminantFlipReady(determinant)
  const transformedProbe = applyMatrix(basisA, basisB, probe)
  const secondTarget = useMemo(
    () => lockedEigenOne
      ? remainingEigenPair(basisA, basisB, lockedEigenOne.direction)
      : null,
    [basisA, basisB, lockedEigenOne],
  )
  const firstEigenProgress = mode === 'eigen-hunt'
    ? eigenDirectionProgress(basisA, basisB, probe)
    : 0
  const secondEigenProgress = mode === 'eigen-second-hunt' && secondTarget
    ? directionMatchProgress(probe, secondTarget.direction)
    : 0
  const activeEigenProgress = mode === 'eigen-second-hunt' ? secondEigenProgress : firstEigenProgress
  const firstEigenHit = mode === 'eigen-hunt' && isEigenDirectionHit(basisA, basisB, probe)
  const secondEigenHit = mode === 'eigen-second-hunt'
    && secondTarget !== null
    && isDirectionMatchHit(probe, secondTarget.direction)

  useEffect(() => {
    if (!context) return
    if (mode === 'basis') markConceptDiscovered('orthogonal-basis')
    if (mode === 'matrix') markConceptDiscovered('matrix')
    if (mode === 'determinant') markConceptDiscovered('determinant')
    if (mode === 'eigen-second-hunt') markConceptDiscovered('eigenvector')
    if (mode === 'eigenbasis') markConceptDiscovered('eigenbasis')
    if (mode === 'diagonalization') markConceptDiscovered('diagonalization')
  }, [context, mode])

  useEffect(() => {
    let frame = 0
    if (mode !== 'matrix') {
      frame = requestAnimationFrame(() => setCollapseDwell(mode === 'determinant' ? 1 : 0))
      return () => cancelAnimationFrame(frame)
    }
    if (!collapseHit) {
      frame = requestAnimationFrame(() => setCollapseDwell(0))
      return () => cancelAnimationFrame(frame)
    }

    let startedAt: number | null = null
    const tick = (now: number) => {
      if (startedAt === null) startedAt = now
      const progress = targetDwellProgress(now - startedAt, MATRIX_SINGULAR_DWELL_MS)
      setCollapseDwell(progress)
      if (progress >= 1) {
        const currentA = basisARef.current
        const currentB = basisBRef.current
        setPreCollapse({ a: currentA, b: currentB })
        if (lastMovedRef.current === 'a') {
          const snapped = nearestCollinearVector(currentA, currentB)
          basisARef.current = snapped
          setBasisA(snapped)
        } else {
          const snapped = nearestCollinearVector(currentB, currentA)
          basisBRef.current = snapped
          setBasisB(snapped)
        }
        setMode('determinant')
        return
      }
      frame = requestAnimationFrame(tick)
    }

    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [collapseHit, mode])

  useEffect(() => {
    let frame = 0
    if (!flipReady) {
      frame = requestAnimationFrame(() => setFlipDwell(0))
      return () => cancelAnimationFrame(frame)
    }

    let startedAt: number | null = null
    const tick = (now: number) => {
      if (startedAt === null) startedAt = now
      const progress = targetDwellProgress(now - startedAt, MATRIX_FLIP_DWELL_MS)
      setFlipDwell(progress)
      if (progress >= 1) {
        const pairs = realEigenPairs(basisARef.current, basisBRef.current)
        if (pairs.length < 2) return
        const initialProbe = normalizeTo(rotate(pairs[0].direction, 34 * Math.PI / 180), PROBE_MAGNITUDE)
        probeRef.current = initialProbe
        setProbe(initialProbe)
        setLockedEigenOne(null)
        setLockedEigenTwo(null)
        setEigenDwell(0)
        setMode('eigen-hunt')
        return
      }
      frame = requestAnimationFrame(tick)
    }
    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [flipReady])

  useEffect(() => {
    let frame = 0
    const activeHit = mode === 'eigen-second-hunt' ? secondEigenHit : firstEigenHit
    if (!isProbeMode(mode) || !activeHit) {
      frame = requestAnimationFrame(() => setEigenDwell(0))
      return () => cancelAnimationFrame(frame)
    }

    let startedAt: number | null = null
    const dwellMs = mode === 'eigen-second-hunt' ? EIGEN_SECOND_DWELL_MS : EIGENVECTOR_DWELL_MS
    const tick = (now: number) => {
      if (startedAt === null) startedAt = now
      const progress = targetDwellProgress(now - startedAt, dwellMs)
      setEigenDwell(progress)
      if (progress >= 1) {
        if (mode === 'eigen-hunt') {
          const pair = nearestEigenPair(basisARef.current, basisBRef.current, probeRef.current)
          if (!pair) return
          const snapped = nearestLineDirection(probeRef.current, pair.direction)
          probeRef.current = snapped
          setProbe(snapped)
          setLockedEigenOne(pair)
          const remaining = remainingEigenPair(basisARef.current, basisBRef.current, pair.direction)
          if (!remaining) return
          const nextProbe = normalizeTo(rotate(remaining.direction, -31 * Math.PI / 180), PROBE_MAGNITUDE)
          probeRef.current = nextProbe
          setProbe(nextProbe)
          setEigenDwell(0)
          setMode('eigen-second-hunt')
          return
        }

        if (!secondTarget) return
        const snapped = nearestLineDirection(probeRef.current, secondTarget.direction)
        probeRef.current = snapped
        setProbe(snapped)
        setLockedEigenTwo(secondTarget)
        setEigenDwell(1)
        setMode('eigenbasis')
        return
      }
      frame = requestAnimationFrame(tick)
    }
    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [firstEigenHit, mode, secondEigenHit, secondTarget])

  useEffect(() => {
    if (mode !== 'eigenbasis') return undefined
    const timer = window.setTimeout(() => setMode('diagonalization'), EIGENBASIS_SETTLE_MS)
    return () => window.clearTimeout(timer)
  }, [mode])

  useEffect(() => {
    const card = context?.card
    const toolbar = context?.toolbar
    const dock = context?.dock
    const reset = context?.reset
    if (!card) return undefined

    const active = mode !== 'basis'
    card.classList.toggle('matrix-active', active)
    card.classList.toggle('determinant-active', mode === 'determinant')
    card.classList.toggle('eigen-hunt-active', mode === 'eigen-hunt')
    card.classList.toggle('eigen-second-hunt-active', mode === 'eigen-second-hunt')
    card.classList.toggle('eigenbasis-active', mode === 'eigenbasis')
    card.classList.toggle('diagonalization-active', mode === 'diagonalization')
    toolbar?.classList.toggle('matrix-overlay-active', active)
    dock?.classList.toggle('matrix-overlay-active', active)
    reset?.classList.toggle('matrix-hidden', active)

    return () => {
      card.classList.remove(
        'matrix-active',
        'determinant-active',
        'eigen-hunt-active',
        'eigen-second-hunt-active',
        'eigenbasis-active',
        'diagonalization-active',
      )
      toolbar?.classList.remove('matrix-overlay-active')
      dock?.classList.remove('matrix-overlay-active')
      reset?.classList.remove('matrix-hidden')
    }
  }, [context, mode])

  const aScreen = context ? vectorToScreen(basisA, context) : { x: 0, y: 0 }
  const bScreen = context ? vectorToScreen(basisB, context) : { x: 0, y: 0 }
  const cellCorner = context ? addBasisScreen(context, basisA, 1, basisB, 1) : { x: 0, y: 0 }
  const cellCenter = context ? addBasisScreen(context, basisA, 0.5, basisB, 0.5) : { x: 0, y: 0 }
  const probeScreen = context ? vectorToScreen(probe, context) : { x: 0, y: 0 }
  const transformedProbeScreen = context ? vectorToScreen(transformedProbe, context) : { x: 0, y: 0 }

  useEffect(() => {
    const svg = context?.svg
    if (!svg || !context) return undefined

    const fitA = vectorToScreen(basisA, context)
    const fitB = vectorToScreen(basisB, context)
    const fitCorner = addBasisScreen(context, basisA, 1, basisB, 1)
    const points = [context.origin, fitA, fitB, fitCorner]
    if (isProbeMode(mode)) {
      points.push(vectorToScreen(probe, context), vectorToScreen(applyMatrix(basisA, basisB, probe), context))
    }
    if (lockedEigenOne) {
      points.push(
        vectorToScreen(combine(lockedEigenOne.direction, 2, { x: 0, y: 0 }, 0), context),
        vectorToScreen(combine(lockedEigenOne.direction, -2, { x: 0, y: 0 }, 0), context),
      )
    }
    if (lockedEigenTwo) {
      points.push(
        vectorToScreen(combine(lockedEigenTwo.direction, 2, { x: 0, y: 0 }, 0), context),
        vectorToScreen(combine(lockedEigenTwo.direction, -2, { x: 0, y: 0 }, 0), context),
      )
    }
    const xs = points.map((point) => point.x)
    const ys = points.map((point) => point.y)
    const minX = Math.min(...xs) - 76
    const maxX = Math.max(...xs) + 76
    const minY = Math.min(...ys) - 68
    const maxY = Math.max(...ys) + 68
    const width = Math.max(1, maxX - minX)
    const height = Math.max(1, maxY - minY)
    const maxScale = isEigenMode(mode) ? 1.12 : 1.1
    const scale = Math.min(maxScale, 710 / width, 382 / height)
    const centerX = (minX + maxX) / 2
    const centerY = (minY + maxY) / 2
    const shiftX = scale * (VIEW_WIDTH / 2 - centerX) / VIEW_WIDTH * 100
    const shiftY = scale * (VIEW_HEIGHT / 2 - centerY) / VIEW_HEIGHT * 100

    svg.style.setProperty('--addition-fit-scale', scale.toFixed(4))
    svg.style.setProperty('--addition-fit-x', `${shiftX.toFixed(3)}%`)
    svg.style.setProperty('--addition-fit-y', `${shiftY.toFixed(3)}%`)
    return undefined
  }, [basisA, basisB, context, lockedEigenOne, lockedEigenTwo, mode, probe])

  if (!context) return null

  const canMoveAxes = mode === 'basis' || mode === 'matrix' || mode === 'determinant'

  const handlePointerDown = (event: ReactPointerEvent<SVGCircleElement>) => {
    if (!canMoveAxes) return
    event.stopPropagation()
    const axis = axisFromElement(event.currentTarget)
    lastMovedRef.current = axis
    if (mode === 'basis') setMode('matrix')
    event.currentTarget.setPointerCapture(event.pointerId)
  }

  const handlePointerMove = (event: ReactPointerEvent<SVGCircleElement>) => {
    if (!canMoveAxes || !event.currentTarget.hasPointerCapture(event.pointerId)) return
    event.stopPropagation()
    const svg = event.currentTarget.ownerSVGElement
    if (!svg) return
    const axis = axisFromElement(event.currentTarget)
    const value = clampVectorMagnitude(clientToVector(svg, context, event.clientX, event.clientY), BASIS_MAX_MAGNITUDE)
    lastMovedRef.current = axis
    if (axis === 'a') {
      basisARef.current = value
      setBasisA(value)
    } else {
      basisBRef.current = value
      setBasisB(value)
    }
  }

  const handlePointerUp = (event: ReactPointerEvent<SVGCircleElement>) => {
    event.stopPropagation()
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId)
    }
  }

  const handleKeyDown = (event: ReactKeyboardEvent<SVGCircleElement>) => {
    if (!canMoveAxes) return
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
    const axis = axisFromElement(event.currentTarget)
    lastMovedRef.current = axis
    if (mode === 'basis') setMode('matrix')

    if (axis === 'a') {
      const value = clampVectorMagnitude({ x: basisA.x + delta.x, y: basisA.y + delta.y }, BASIS_MAX_MAGNITUDE)
      basisARef.current = value
      setBasisA(value)
    } else {
      const value = clampVectorMagnitude({ x: basisB.x + delta.x, y: basisB.y + delta.y }, BASIS_MAX_MAGNITUDE)
      basisBRef.current = value
      setBasisB(value)
    }
  }

  const setProbeDirection = (value: Point2) => {
    const next = normalizeTo(value, PROBE_MAGNITUDE)
    probeRef.current = next
    setProbe(next)
  }

  const handleProbePointerDown = (event: ReactPointerEvent<SVGCircleElement>) => {
    if (!isProbeMode(mode)) return
    event.stopPropagation()
    event.currentTarget.setPointerCapture(event.pointerId)
  }

  const handleProbePointerMove = (event: ReactPointerEvent<SVGCircleElement>) => {
    if (!isProbeMode(mode) || !event.currentTarget.hasPointerCapture(event.pointerId)) return
    event.stopPropagation()
    const svg = event.currentTarget.ownerSVGElement
    if (!svg) return
    setProbeDirection(clientToVector(svg, context, event.clientX, event.clientY))
  }

  const handleProbeKeyDown = (event: ReactKeyboardEvent<SVGCircleElement>) => {
    if (!isProbeMode(mode)) return
    const direction = event.key === 'ArrowLeft' || event.key === 'ArrowDown'
      ? -1
      : event.key === 'ArrowRight' || event.key === 'ArrowUp'
        ? 1
        : 0
    if (!direction) return
    event.preventDefault()
    event.stopPropagation()
    const step = (event.shiftKey ? 12 : 5) * Math.PI / 180 * direction
    setProbeDirection(rotate(probe, step))
  }

  const gridOffsets = [-2, -1, 0, 1, 2]
  const gridSpan = 2.45
  const cellPoints = [context.origin, aScreen, cellCorner, bScreen]
  const dominant = Math.hypot(basisA.x, basisA.y) >= Math.hypot(basisB.x, basisB.y) ? basisA : basisB
  const seamStart = addBasisScreen(context, dominant, -2.5, { x: 0, y: 0 }, 0)
  const seamEnd = addBasisScreen(context, dominant, 2.5, { x: 0, y: 0 }, 0)
  const probeDirection = normalizeTo(probe, 1)
  const eigenGuideStart = vectorToScreen({ x: -probeDirection.x * 1.7, y: -probeDirection.y * 1.7 }, context)
  const eigenGuideEnd = vectorToScreen({ x: probeDirection.x * 1.7, y: probeDirection.y * 1.7 }, context)
  const eigenSpan = 2.1
  const eigenGridOffsets = [-2, -1, 0, 1, 2]

  const lockedLine = (pair: EigenPair, className: string, label: string) => {
    const start = vectorToScreen({ x: -pair.direction.x * 2, y: -pair.direction.y * 2 }, context)
    const end = vectorToScreen({ x: pair.direction.x * 2, y: pair.direction.y * 2 }, context)
    const labelPoint = vectorToScreen({ x: pair.direction.x * 1.12, y: pair.direction.y * 1.12 }, context)
    return (
      <g className={`eigen-locked-direction ${className}`} pointerEvents="none">
        <line x1={start.x} y1={start.y} x2={end.x} y2={end.y} />
        <text x={labelPoint.x} y={labelPoint.y - 8} textAnchor="middle">{label}</text>
      </g>
    )
  }

  const showEigenBasis = (mode === 'eigenbasis' || mode === 'diagonalization') && lockedEigenOne && lockedEigenTwo
  const svgPortal = createPortal(
    <g className={`matrix-determinant-extension mode-${mode}`}>
      {mode !== 'basis' && !showEigenBasis && (
        <>
          <g className="matrix-warp-grid" pointerEvents="none">
            {gridOffsets.map((offset) => {
              const from = addBasisScreen(context, basisA, -gridSpan, basisB, offset)
              const to = addBasisScreen(context, basisA, gridSpan, basisB, offset)
              return <line key={`a-${offset}`} x1={from.x} y1={from.y} x2={to.x} y2={to.y} />
            })}
            {gridOffsets.map((offset) => {
              const from = addBasisScreen(context, basisA, offset, basisB, -gridSpan)
              const to = addBasisScreen(context, basisA, offset, basisB, gridSpan)
              return <line key={`b-${offset}`} x1={from.x} y1={from.y} x2={to.x} y2={to.y} />
            })}
          </g>
          <line
            x1={seamStart.x}
            y1={seamStart.y}
            x2={seamEnd.x}
            y2={seamEnd.y}
            className="matrix-collapse-seam"
            style={{ opacity: mode === 'matrix' ? collapseProgress : mode === 'determinant' ? Math.max(0.15, flipProgress) : 0 }}
            pointerEvents="none"
          />
          <polygon
            points={cellPoints.map((point) => `${point.x},${point.y}`).join(' ')}
            className={`matrix-unit-cell orientation-${orientation}`}
            pointerEvents="none"
          />
          {mode === 'matrix' && collapseProgress > 0 && (
            <polygon
              points={cellPoints.map((point) => `${point.x},${point.y}`).join(' ')}
              className="matrix-collapse-dwell"
              pathLength="1"
              strokeDasharray="1"
              strokeDashoffset={1 - collapseDwell}
              pointerEvents="none"
            />
          )}
          {mode === 'determinant' && flipProgress > 0 && (
            <polygon
              points={cellPoints.map((point) => `${point.x},${point.y}`).join(' ')}
              className="matrix-flip-dwell"
              pathLength="1"
              strokeDasharray="1"
              strokeDashoffset={1 - flipDwell}
              pointerEvents="none"
            />
          )}
          {mode === 'determinant' && (
            <text x={cellCenter.x} y={cellCenter.y - 12} className="matrix-det-label" textAnchor="middle" pointerEvents="none">
              det M
            </text>
          )}
        </>
      )}

      {!showEigenBasis && (
        <>
          <line x1={context.origin.x} y1={context.origin.y} x2={aScreen.x} y2={aScreen.y} className="matrix-basis-axis matrix-basis-a" pointerEvents="none" />
          <line x1={context.origin.x} y1={context.origin.y} x2={bScreen.x} y2={bScreen.y} className="matrix-basis-axis matrix-basis-b" pointerEvents="none" />
        </>
      )}

      {canMoveAxes && (
        <>
          <circle cx={aScreen.x} cy={aScreen.y} r="12" className="matrix-axis-handle-ring matrix-axis-a" pointerEvents="none" />
          <circle cx={bScreen.x} cy={bScreen.y} r="12" className="matrix-axis-handle-ring matrix-axis-b" pointerEvents="none" />
          <circle
            data-axis="a"
            cx={aScreen.x}
            cy={aScreen.y}
            r="32"
            className="matrix-axis-hit"
            role="slider"
            tabIndex={0}
            aria-label="基底e1の先端。ドラッグすると格子全体が変形する"
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerCancel={handlePointerUp}
            onKeyDown={handleKeyDown}
          />
          <circle
            data-axis="b"
            cx={bScreen.x}
            cy={bScreen.y}
            r="32"
            className="matrix-axis-hit"
            role="slider"
            tabIndex={0}
            aria-label="基底e2の先端。ドラッグすると格子全体が変形する"
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerCancel={handlePointerUp}
            onKeyDown={handleKeyDown}
          />
        </>
      )}

      {lockedEigenOne && mode !== 'eigen-hunt' && lockedLine(lockedEigenOne, 'eigen-locked-one', 'v₁')}
      {lockedEigenTwo && lockedLine(lockedEigenTwo, 'eigen-locked-two', 'v₂')}

      {isProbeMode(mode) && (
        <g className={`eigen-hunt-layer ${mode === 'eigen-second-hunt' ? 'is-second-hunt' : ''}`}>
          <line
            x1={eigenGuideStart.x}
            y1={eigenGuideStart.y}
            x2={eigenGuideEnd.x}
            y2={eigenGuideEnd.y}
            className="eigen-direction-guide"
            style={{ opacity: 0.08 + activeEigenProgress * 0.62 }}
            pointerEvents="none"
          />
          <line
            x1={context.origin.x}
            y1={context.origin.y}
            x2={probeScreen.x}
            y2={probeScreen.y}
            className="eigen-probe-original"
            pointerEvents="none"
          />
          <line
            x1={context.origin.x}
            y1={context.origin.y}
            x2={transformedProbeScreen.x}
            y2={transformedProbeScreen.y}
            className="eigen-probe-transformed"
            pointerEvents="none"
          />
          <circle cx={transformedProbeScreen.x} cy={transformedProbeScreen.y} r="7" className="eigen-transformed-tip" pointerEvents="none" />
          <circle cx={probeScreen.x} cy={probeScreen.y} r="12" className="eigen-probe-ring" pointerEvents="none" />
          <circle
            cx={probeScreen.x}
            cy={probeScreen.y}
            r="17"
            pathLength="1"
            className="eigen-probe-dwell"
            strokeDasharray="1"
            strokeDashoffset={1 - eigenDwell}
            transform={`rotate(-90 ${probeScreen.x} ${probeScreen.y})`}
            pointerEvents="none"
          />
          <circle
            cx={probeScreen.x}
            cy={probeScreen.y}
            r="34"
            className="eigen-probe-hit"
            role="slider"
            tabIndex={0}
            aria-label={mode === 'eigen-second-hunt'
              ? '2本目の不変方向を探す針。回して変形前後の方向を重ねる'
              : '方向を探す針。回して変形前後の方向を重ねる'}
            onPointerDown={handleProbePointerDown}
            onPointerMove={handleProbePointerMove}
            onPointerUp={handlePointerUp}
            onPointerCancel={handlePointerUp}
            onKeyDown={handleProbeKeyDown}
          />
        </g>
      )}

      {showEigenBasis && (
        <g className={`eigenbasis-layer ${mode === 'diagonalization' ? 'is-diagonalized' : ''}`} pointerEvents="none">
          <g className="eigenbasis-source-grid">
            {eigenGridOffsets.map((offset) => {
              const from = vectorToScreen(combine(lockedEigenOne.direction, -eigenSpan, lockedEigenTwo.direction, offset), context)
              const to = vectorToScreen(combine(lockedEigenOne.direction, eigenSpan, lockedEigenTwo.direction, offset), context)
              return <line key={`source-v1-${offset}`} x1={from.x} y1={from.y} x2={to.x} y2={to.y} />
            })}
            {eigenGridOffsets.map((offset) => {
              const from = vectorToScreen(combine(lockedEigenOne.direction, offset, lockedEigenTwo.direction, -eigenSpan), context)
              const to = vectorToScreen(combine(lockedEigenOne.direction, offset, lockedEigenTwo.direction, eigenSpan), context)
              return <line key={`source-v2-${offset}`} x1={from.x} y1={from.y} x2={to.x} y2={to.y} />
            })}
          </g>
          <g className="eigenbasis-transformed-grid">
            {eigenGridOffsets.map((offset) => {
              const from = vectorToScreen(applyMatrix(basisA, basisB, combine(lockedEigenOne.direction, -eigenSpan, lockedEigenTwo.direction, offset)), context)
              const to = vectorToScreen(applyMatrix(basisA, basisB, combine(lockedEigenOne.direction, eigenSpan, lockedEigenTwo.direction, offset)), context)
              return <line key={`transformed-v1-${offset}`} x1={from.x} y1={from.y} x2={to.x} y2={to.y} />
            })}
            {eigenGridOffsets.map((offset) => {
              const from = vectorToScreen(applyMatrix(basisA, basisB, combine(lockedEigenOne.direction, offset, lockedEigenTwo.direction, -eigenSpan)), context)
              const to = vectorToScreen(applyMatrix(basisA, basisB, combine(lockedEigenOne.direction, offset, lockedEigenTwo.direction, eigenSpan)), context)
              return <line key={`transformed-v2-${offset}`} x1={from.x} y1={from.y} x2={to.x} y2={to.y} />
            })}
          </g>
          {mode === 'diagonalization' && (
            <text x={context.origin.x} y={context.origin.y + 34} className="diagonalization-equation" textAnchor="middle">
              P⁻¹MP = diag(λ₁, λ₂)
            </text>
          )}
        </g>
      )}
    </g>,
    context.svg,
  )

  const dwellPercent = Math.round(collapseDwell * 100)
  const flipPercent = Math.round(flipDwell * 100)
  const eigenPercent = Math.round(activeEigenProgress * 100)
  const eigenDwellPercent = Math.round(eigenDwell * 100)
  const lambdaOne = lockedEigenOne?.value ?? 0
  const lambdaTwo = lockedEigenTwo?.value ?? secondTarget?.value ?? 0

  const toolbarPortal = mode !== 'basis' && context.toolbar
    ? createPortal(
        <>
          <span className="model-mode matrix-mode-label">
            {mode === 'matrix'
              ? 'MATRIX TRANSFORMATION'
              : mode === 'determinant'
                ? 'DETERMINANT'
                : mode === 'eigen-hunt'
                  ? 'STEADY DIRECTION'
                  : mode === 'eigen-second-hunt'
                    ? 'SECOND DIRECTION'
                    : mode === 'eigenbasis'
                      ? 'EIGENBASIS'
                      : 'DIAGONALIZATION'}
          </span>
          <span className="gateway-whisper matrix-whisper">
            {mode === 'matrix'
              ? dwellPercent > 0 ? `hold it flat ${dwellPercent}%` : 'grab one tip · squeeze one cell flat'
              : mode === 'determinant'
                ? flipPercent > 0 ? `keep it flipped ${flipPercent}%` : 'pull one axis through the collapse line'
                : mode === 'eigen-hunt'
                  ? eigenDwellPercent > 0 ? `hold the overlap ${eigenDwellPercent}%` : 'turn the needle · overlap the two directions'
                  : mode === 'eigen-second-hunt'
                    ? eigenDwellPercent > 0 ? `hold the second overlap ${eigenDwellPercent}%` : 'one line locked · find the other'
                    : mode === 'eigenbasis'
                      ? 'two invariant lines locked'
                      : 'λ₁ × v₁ · λ₂ × v₂'}
          </span>
        </>,
        context.toolbar,
      )
    : null

  const dockPortal = mode !== 'basis' && context.dock
    ? createPortal(
        <div className={`matrix-bottom-status ${isEigenMode(mode) ? 'eigen-bottom-status' : ''}`} aria-live="polite">
          <span>
            {mode === 'matrix'
              ? 'fundamental cell'
              : mode === 'determinant'
                ? 'det M = signed area'
                : mode === 'eigen-hunt'
                  ? 'direction match'
                  : mode === 'eigen-second-hunt'
                    ? '1 / 2 invariant lines'
                    : mode === 'eigenbasis'
                      ? '2 / 2 invariant lines'
                      : 'P⁻¹MP'}
          </span>
          <strong>
            {mode === 'matrix'
              ? `area ${vectorComponentLabel(Math.abs(determinant))}`
              : mode === 'determinant'
                ? vectorComponentLabel(determinant)
                : mode === 'eigen-hunt' || mode === 'eigen-second-hunt'
                  ? `${eigenPercent}%`
                  : mode === 'eigenbasis'
                    ? `λ₁ ${vectorComponentLabel(lambdaOne)} · λ₂ ${vectorComponentLabel(lambdaTwo)}`
                    : `diag(${vectorComponentLabel(lambdaOne)}, ${vectorComponentLabel(lambdaTwo)})`}
          </strong>
          <small>
            {mode === 'matrix'
              ? collapseProgress > 0 ? `squeeze the cell flat · ${dwellPercent}%` : 'the whole grid follows the two handles'
              : mode === 'determinant'
                ? orientation === 0
                  ? '2D collapsed to a line'
                  : orientation > 0
                    ? 'pull through zero to flip the cell'
                    : flipDwell > 0
                      ? `orientation flipped · hold ${flipPercent}%`
                      : 'orientation flipped'
                : mode === 'eigen-hunt'
                  ? eigenDwell > 0 ? `same line · hold ${eigenDwellPercent}%` : 'rotate the live needle until the two lines coincide'
                  : mode === 'eigen-second-hunt'
                    ? eigenDwell > 0 ? `second line · hold ${eigenDwellPercent}%` : 'the first line stays locked while you search'
                    : mode === 'eigenbasis'
                      ? 'the grid is changing coordinates'
                      : 'the same transform is now two independent axis scales'}
          </small>
        </div>,
        context.dock,
      )
    : null

  const goBack = () => {
    if (isEigenMode(mode)) {
      setEigenDwell(0)
      setFlipDwell(0)
      setLockedEigenOne(null)
      setLockedEigenTwo(null)
      setMode('determinant')
      return
    }
    if (mode === 'determinant') {
      if (preCollapse) {
        basisARef.current = preCollapse.a
        basisBRef.current = preCollapse.b
        setBasisA(preCollapse.a)
        setBasisB(preCollapse.b)
      }
      setCollapseDwell(0)
      setFlipDwell(0)
      setMode('matrix')
      return
    }
    basisARef.current = context.initialA
    basisBRef.current = context.initialB
    setBasisA(context.initialA)
    setBasisB(context.initialB)
    setCollapseDwell(0)
    setMode('basis')
  }

  const backPortal = mode !== 'basis'
    ? createPortal(
        <button
          type="button"
          className="matrix-back"
          aria-label={isEigenMode(mode) ? '行列式表示に戻る' : mode === 'determinant' ? '行列変形に戻る' : '直交基底に戻る'}
          onClick={goBack}
        >
          <span aria-hidden="true">‹</span>
        </button>,
        context.card,
      )
    : null

  return (
    <>
      {svgPortal}
      {toolbarPortal}
      {dockPortal}
      {backPortal}
    </>
  )
}
