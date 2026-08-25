import {
  useEffect,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type PointerEvent as ReactPointerEvent,
} from 'react'
import { createPortal } from 'react-dom'
import {
  determinantOrientation,
  determinantTargetProgress,
  isDeterminantCollapseTarget,
  matrixDeterminant,
  MATRIX_SINGULAR_DWELL_MS,
  nearestCollinearVector,
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

type Mode = 'basis' | 'matrix' | 'determinant'
type AxisName = 'a' | 'b'

type MatrixContext = {
  svg: SVGSVGElement
  card: HTMLElement
  toolbar: HTMLElement | null
  dock: HTMLElement | null
  origin: Point2
  xBasisPoint: Point2
  yBasisPoint: Point2
  initialA: Point2
  initialB: Point2
}

type DragState = {
  pointerId: number
  axis: AxisName
  startX: number
  startY: number
}

const numberAttr = (element: Element, name: string) => Number(element.getAttribute(name) ?? 0)

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
    y: (xStart.y + xEnd.y) / 2,
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
): Point2 => {
  const point = {
    x: a.x * aScale + b.x * bScale,
    y: a.y * aScale + b.y * bScale,
  }
  return vectorToScreen(point, context)
}

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
  return clampVectorMagnitude(
    screenPointToVector(point, context.origin, context.xBasisPoint, context.yBasisPoint),
    BASIS_MAX_MAGNITUDE,
  )
}

export default function MatrixDeterminantPortal() {
  const [context, setContext] = useState<MatrixContext | null>(null)
  const [mode, setMode] = useState<Mode>('basis')
  const [basisA, setBasisA] = useState<Point2>({ x: 1, y: 0 })
  const [basisB, setBasisB] = useState<Point2>({ x: 0, y: 1 })
  const [collapseDwell, setCollapseDwell] = useState(0)
  const contextRef = useRef<MatrixContext | null>(null)
  const basisARef = useRef<Point2>(basisA)
  const basisBRef = useRef<Point2>(basisB)
  const dragRef = useRef<DragState | null>(null)
  const lastMovedRef = useRef<AxisName>('b')
  const preCollapseRef = useRef<{ a: Point2; b: Point2 } | null>(null)

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
        preCollapseRef.current = null
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

  useEffect(() => {
    let frame = 0
    if (mode === 'determinant') {
      frame = requestAnimationFrame(() => setCollapseDwell(1))
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
        preCollapseRef.current = { a: currentA, b: currentB }
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
    const card = context?.card
    if (!card) return undefined
    card.classList.toggle('matrix-active', mode !== 'basis')
    card.classList.toggle('determinant-active', mode === 'determinant')
    return () => {
      card.classList.remove('matrix-active', 'determinant-active')
    }
  }, [context?.card, mode])

  const aScreen = context ? vectorToScreen(basisA, context) : { x: 0, y: 0 }
  const bScreen = context ? vectorToScreen(basisB, context) : { x: 0, y: 0 }
  const cellCorner = context ? addBasisScreen(context, basisA, 1, basisB, 1) : { x: 0, y: 0 }
  const cellCenter = context ? addBasisScreen(context, basisA, 0.5, basisB, 0.5) : { x: 0, y: 0 }

  useEffect(() => {
    const svg = context?.svg
    if (!svg || !context) return undefined

    const points = [context.origin, aScreen, bScreen, cellCorner]
    const xs = points.map((point) => point.x)
    const ys = points.map((point) => point.y)
    const minX = Math.min(...xs) - 76
    const maxX = Math.max(...xs) + 76
    const minY = Math.min(...ys) - 68
    const maxY = Math.max(...ys) + 68
    const width = Math.max(1, maxX - minX)
    const height = Math.max(1, maxY - minY)
    const scale = Math.min(1.1, 710 / width, 382 / height)
    const centerX = (minX + maxX) / 2
    const centerY = (minY + maxY) / 2
    const shiftX = scale * (VIEW_WIDTH / 2 - centerX) / VIEW_WIDTH * 100
    const shiftY = scale * (VIEW_HEIGHT / 2 - centerY) / VIEW_HEIGHT * 100

    svg.style.setProperty('--addition-fit-scale', scale.toFixed(4))
    svg.style.setProperty('--addition-fit-x', `${shiftX.toFixed(3)}%`)
    svg.style.setProperty('--addition-fit-y', `${shiftY.toFixed(3)}%`)
    return undefined
  }, [aScreen.x, aScreen.y, bScreen.x, bScreen.y, cellCorner.x, cellCorner.y, context])

  if (!context) return null

  const updateAxis = (axis: AxisName, value: Point2) => {
    lastMovedRef.current = axis
    if (axis === 'a') {
      basisARef.current = value
      setBasisA(value)
    } else {
      basisBRef.current = value
      setBasisB(value)
    }
  }

  const pointerDown = (axis: AxisName) => (event: ReactPointerEvent<SVGCircleElement>) => {
    event.stopPropagation()
    dragRef.current = {
      pointerId: event.pointerId,
      axis,
      startX: event.clientX,
      startY: event.clientY,
    }
    event.currentTarget.setPointerCapture(event.pointerId)
  }

  const pointerMove = (event: ReactPointerEvent<SVGCircleElement>) => {
    const drag = dragRef.current
    if (!drag || drag.pointerId !== event.pointerId) return
    event.stopPropagation()
    const svg = event.currentTarget.ownerSVGElement
    if (!svg) return

    if (mode === 'basis' && Math.hypot(event.clientX - drag.startX, event.clientY - drag.startY) >= 8) {
      setMode('matrix')
    }
    updateAxis(drag.axis, clientToVector(svg, context, event.clientX, event.clientY))
  }

  const pointerUp = (event: ReactPointerEvent<SVGCircleElement>) => {
    event.stopPropagation()
    dragRef.current = null
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId)
    }
  }

  const keyDown = (axis: AxisName) => (event: ReactKeyboardEvent<SVGCircleElement>) => {
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
    if (mode === 'basis') setMode('matrix')
    const current = axis === 'a' ? basisARef.current : basisBRef.current
    updateAxis(axis, clampVectorMagnitude({
      x: current.x + delta.x,
      y: current.y + delta.y,
    }, BASIS_MAX_MAGNITUDE))
  }

  const gridOffsets = [-2, -1, 0, 1, 2]
  const gridSpan = 2.45
  const cellPoints = [context.origin, aScreen, cellCorner, bScreen]
  const dominant = Math.hypot(basisA.x, basisA.y) >= Math.hypot(basisB.x, basisB.y) ? basisA : basisB
  const seamStart = addBasisScreen(context, dominant, -2.5, { x: 0, y: 0 }, 0)
  const seamEnd = addBasisScreen(context, dominant, 2.5, { x: 0, y: 0 }, 0)

  const svgPortal = createPortal(
    <g className={`matrix-determinant-extension mode-${mode}`}>
      {mode !== 'basis' && (
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
            style={{ opacity: collapseProgress }}
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
          {mode === 'determinant' && (
            <text x={cellCenter.x} y={cellCenter.y - 12} className="matrix-det-label" textAnchor="middle" pointerEvents="none">
              det M
            </text>
          )}
        </>
      )}

      <line x1={context.origin.x} y1={context.origin.y} x2={aScreen.x} y2={aScreen.y} className="matrix-basis-axis matrix-basis-a" pointerEvents="none" />
      <line x1={context.origin.x} y1={context.origin.y} x2={bScreen.x} y2={bScreen.y} className="matrix-basis-axis matrix-basis-b" pointerEvents="none" />
      <circle cx={aScreen.x} cy={aScreen.y} r="12" className="matrix-axis-handle-ring matrix-axis-a" pointerEvents="none" />
      <circle cx={bScreen.x} cy={bScreen.y} r="12" className="matrix-axis-handle-ring matrix-axis-b" pointerEvents="none" />
      <circle
        cx={aScreen.x}
        cy={aScreen.y}
        r="32"
        className="matrix-axis-hit"
        role="slider"
        tabIndex={0}
        aria-label="基底e1の先端。ドラッグすると格子全体が変形する"
        onPointerDown={pointerDown('a')}
        onPointerMove={pointerMove}
        onPointerUp={pointerUp}
        onPointerCancel={pointerUp}
        onKeyDown={keyDown('a')}
      />
      <circle
        cx={bScreen.x}
        cy={bScreen.y}
        r="32"
        className="matrix-axis-hit"
        role="slider"
        tabIndex={0}
        aria-label="基底e2の先端。ドラッグすると格子全体が変形する"
        onPointerDown={pointerDown('b')}
        onPointerMove={pointerMove}
        onPointerUp={pointerUp}
        onPointerCancel={pointerUp}
        onKeyDown={keyDown('b')}
      />
    </g>,
    context.svg,
  )

  const dwellPercent = Math.round(collapseDwell * 100)
  const toolbarPortal = mode !== 'basis' && context.toolbar
    ? createPortal(
        <>
          <span className="model-mode matrix-mode-label">{mode === 'determinant' ? 'DETERMINANT' : 'MATRIX TRANSFORMATION'}</span>
          <span className="gateway-whisper matrix-whisper">
            {mode === 'determinant'
              ? 'pull an axis through the seam'
              : dwellPercent > 0
                ? `hold it flat ${dwellPercent}%`
                : 'grab either axis · bend the grid'}
          </span>
        </>,
        context.toolbar,
      )
    : null

  const dockPortal = mode !== 'basis' && context.dock
    ? createPortal(
        <div className="matrix-bottom-status" aria-live="polite">
          <span>{mode === 'determinant' ? 'det M = signed area' : 'fundamental cell'}</span>
          <strong>{mode === 'determinant' ? vectorComponentLabel(determinant) : `area ${vectorComponentLabel(Math.abs(determinant))}`}</strong>
          <small>
            {mode === 'determinant'
              ? orientation === 0
                ? '2D collapsed to a line'
                : orientation > 0
                  ? 'orientation preserved'
                  : 'orientation flipped'
              : collapseProgress > 0
                ? `squeeze the cell flat · ${dwellPercent}%`
                : 'move either handle and watch the whole space follow'}
          </small>
        </div>,
        context.dock,
      )
    : null

  const goBack = () => {
    if (mode === 'determinant') {
      const previous = preCollapseRef.current
      if (previous) {
        basisARef.current = previous.a
        basisBRef.current = previous.b
        setBasisA(previous.a)
        setBasisB(previous.b)
      }
      setCollapseDwell(0)
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
          aria-label={mode === 'determinant' ? '行列変形に戻る' : '直交基底に戻る'}
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
