import {
  useEffect,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type PointerEvent as ReactPointerEvent,
} from 'react'
import { createPortal } from 'react-dom'
import {
  componentGatewayVisibility,
  componentTargetProgress,
  isComponentTargetHit,
  screenPointToVector,
  type Point2,
} from './vectorModel'

const VIEW_WIDTH = 760
const VIEW_HEIGHT = 430

type Geometry = {
  svg: SVGSVGElement
  card: HTMLElement | null
  toolbar: HTMLElement | null
  origin: Point2
  endpoint: Point2
  target: Point2
  xBasisPoint: Point2
  yBasisPoint: Point2
  vector: Point2
}

type DragGesture = {
  pointerId: number
  base: Point2
}

const numberAttr = (element: Element, name: string) => Number(element.getAttribute(name) ?? 0)
const distance = (a: Point2, b: Point2) => Math.hypot(a.x - b.x, a.y - b.y)

const clientToSvgPoint = (svg: SVGSVGElement, clientX: number, clientY: number): Point2 => {
  const rect = svg.getBoundingClientRect()
  if (rect.width <= 0 || rect.height <= 0) return { x: 0, y: 0 }
  return {
    x: ((clientX - rect.left) / rect.width) * VIEW_WIDTH,
    y: ((clientY - rect.top) / rect.height) * VIEW_HEIGHT,
  }
}

const readGeometry = (): Geometry | null => {
  const svg = document.querySelector<SVGSVGElement>('.camera-svg.is-vector-room')
  if (!svg) return null

  const axisLines = svg.querySelectorAll<SVGLineElement>('.vector-grid-axis line')
  const endpointElement = svg.querySelector<SVGCircleElement>('.vector-endpoint-ring')
  const elbowElement = svg.querySelector<SVGCircleElement>('.component-elbow')
  if (axisLines.length < 2 || !endpointElement || !elbowElement) return null

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
  const endpoint = {
    x: numberAttr(endpointElement, 'cx'),
    y: numberAttr(endpointElement, 'cy'),
  }
  const target = {
    x: numberAttr(elbowElement, 'cx'),
    y: numberAttr(elbowElement, 'cy'),
  }

  return {
    svg,
    card: document.querySelector<HTMLElement>('.model-card'),
    toolbar: document.querySelector<HTMLElement>('.model-toolbar'),
    origin,
    endpoint,
    target,
    xBasisPoint,
    yBasisPoint,
    vector: screenPointToVector(endpoint, origin, xBasisPoint, yBasisPoint),
  }
}

const sameGeometry = (a: Geometry | null, b: Geometry | null) => {
  if (!a || !b) return a === b
  return a.svg === b.svg
    && distance(a.origin, b.origin) < 0.01
    && distance(a.endpoint, b.endpoint) < 0.01
    && distance(a.target, b.target) < 0.01
    && Math.abs(a.vector.x - b.vector.x) < 0.001
    && Math.abs(a.vector.y - b.vector.y) < 0.001
}

const chooseHandleBase = (origin: Point2, endpoint: Point2, target: Point2): Point2 => {
  const dx = endpoint.x - origin.x
  const dy = endpoint.y - origin.y
  const length = Math.hypot(dx, dy)
  const midpoint = {
    x: origin.x + dx * 0.58,
    y: origin.y + dy * 0.58,
  }
  const perpendicular = length < 1
    ? { x: Math.SQRT1_2, y: -Math.SQRT1_2 }
    : { x: -dy / length, y: dx / length }

  const candidate = (sign: number) => ({
    x: midpoint.x + perpendicular.x * sign * 42,
    y: midpoint.y + perpendicular.y * sign * 42,
  })
  const score = (point: Point2) => {
    const edgeRoom = Math.min(point.x, VIEW_WIDTH - point.x, point.y, VIEW_HEIGHT - point.y)
    return edgeRoom + Math.min(120, distance(point, target)) * 0.35
  }
  const first = candidate(1)
  const second = candidate(-1)
  return score(first) >= score(second) ? first : second
}

const constrainHandle = (point: Point2, base: Point2, target: Point2): Point2 => {
  const softened = {
    x: base.x + (point.x - base.x) * 0.9,
    y: base.y + (point.y - base.y) * 0.9,
  }
  const dx = softened.x - base.x
  const dy = softened.y - base.y
  const travel = Math.hypot(dx, dy)
  const maxTravel = Math.max(190, distance(base, target) + 42)
  const scale = travel > maxTravel && travel > 0 ? maxTravel / travel : 1
  return {
    x: Math.max(20, Math.min(VIEW_WIDTH - 20, base.x + dx * scale)),
    y: Math.max(20, Math.min(VIEW_HEIGHT - 20, base.y + dy * scale)),
  }
}

const diamondPoints = (center: Point2, radius: number) => [
  `${center.x},${center.y - radius}`,
  `${center.x + radius},${center.y}`,
  `${center.x},${center.y + radius}`,
  `${center.x - radius},${center.y}`,
].join(' ')

const dispatchComponentEnter = () => {
  const hiddenHandle = document.querySelector<SVGPolygonElement>('.component-gateway-handle')
  if (!hiddenHandle) return
  hiddenHandle.dispatchEvent(new KeyboardEvent('keydown', {
    key: 'Enter',
    code: 'Enter',
    bubbles: true,
  }))
}

export default function ComponentPuzzlePortal() {
  const [geometry, setGeometry] = useState<Geometry | null>(null)
  const [armed, setArmed] = useState(false)
  const [dragging, setDragging] = useState(false)
  const [handlePosition, setHandlePosition] = useState<Point2 | null>(null)
  const [proximity, setProximity] = useState(0)
  const [snapping, setSnapping] = useState(false)
  const dragRef = useRef<DragGesture | null>(null)
  const snapTimerRef = useRef<number | null>(null)

  useEffect(() => {
    let frame = 0
    const refresh = () => {
      cancelAnimationFrame(frame)
      frame = requestAnimationFrame(() => {
        const next = readGeometry()
        setGeometry((current) => sameGeometry(current, next) ? current : next)
        if (!next) {
          setArmed(false)
          setDragging(false)
          setHandlePosition(null)
          setProximity(0)
          setSnapping(false)
          return
        }
        if (!dragRef.current && !snapping) {
          setArmed((current) => componentGatewayVisibility(next.vector, current))
        }
      })
    }

    refresh()
    const observer = new MutationObserver(refresh)
    observer.observe(document.body, {
      subtree: true,
      childList: true,
      attributes: true,
      attributeFilter: ['class', 'cx', 'cy', 'x1', 'x2', 'y1', 'y2'],
    })

    return () => {
      observer.disconnect()
      cancelAnimationFrame(frame)
    }
  }, [snapping])

  useEffect(() => {
    const card = geometry?.card
    if (!card) return undefined
    card.classList.add('component-puzzle-active')
    card.classList.toggle('component-puzzle-armed', armed)
    card.classList.toggle('component-puzzle-dragging', dragging)
    card.classList.toggle('component-puzzle-snapping', snapping)
    return () => {
      card.classList.remove(
        'component-puzzle-active',
        'component-puzzle-armed',
        'component-puzzle-dragging',
        'component-puzzle-snapping',
      )
    }
  }, [armed, dragging, geometry?.card, snapping])

  useEffect(() => () => {
    if (snapTimerRef.current !== null) window.clearTimeout(snapTimerRef.current)
  }, [])

  if (!geometry) return null

  const base = chooseHandleBase(geometry.origin, geometry.endpoint, geometry.target)
  const handle = handlePosition ?? base

  const completeAtTarget = () => {
    if (snapping) return
    dragRef.current = null
    setDragging(false)
    setSnapping(true)
    setProximity(1)
    setHandlePosition(geometry.target)
    if (snapTimerRef.current !== null) window.clearTimeout(snapTimerRef.current)
    snapTimerRef.current = window.setTimeout(() => {
      snapTimerRef.current = null
      dispatchComponentEnter()
    }, 170)
  }

  const resetDrag = () => {
    if (snapping) return
    dragRef.current = null
    setDragging(false)
    setHandlePosition(null)
    setProximity(0)
  }

  const handlePointerDown = (event: ReactPointerEvent<SVGPolygonElement>) => {
    if (!armed || snapping) return
    event.stopPropagation()
    dragRef.current = { pointerId: event.pointerId, base }
    setDragging(true)
    setHandlePosition(base)
    setProximity(0)
    event.currentTarget.setPointerCapture(event.pointerId)
  }

  const handlePointerMove = (event: ReactPointerEvent<SVGPolygonElement>) => {
    const drag = dragRef.current
    if (!drag || drag.pointerId !== event.pointerId || snapping) return
    event.stopPropagation()
    const point = clientToSvgPoint(geometry.svg, event.clientX, event.clientY)
    const next = constrainHandle(point, drag.base, geometry.target)
    setHandlePosition(next)
    setProximity(componentTargetProgress(next, geometry.target))
    if (isComponentTargetHit(next, geometry.target)) completeAtTarget()
  }

  const handlePointerUp = (event: ReactPointerEvent<SVGPolygonElement>) => {
    event.stopPropagation()
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId)
    }
    resetDrag()
  }

  const handlePointerCancel = (event: ReactPointerEvent<SVGPolygonElement>) => {
    event.stopPropagation()
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId)
    }
    resetDrag()
  }

  const handleKeyDown = (event: ReactKeyboardEvent<SVGPolygonElement>) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      event.stopPropagation()
      completeAtTarget()
      return
    }
    if (event.key === 'Escape') {
      event.preventDefault()
      event.stopPropagation()
      resetDrag()
    }
  }

  const previewOpacity = dragging || snapping ? 0.18 + proximity * 0.82 : 0

  const svgPortal = createPortal(
    <g className="component-puzzle-layer">
      {(dragging || snapping) && (
        <g className="component-target-preview" style={{ opacity: previewOpacity }} pointerEvents="none">
          <line
            x1={geometry.origin.x}
            y1={geometry.origin.y}
            x2={geometry.target.x}
            y2={geometry.target.y}
            className="component-preview-line component-preview-x"
          />
          <line
            x1={geometry.target.x}
            y1={geometry.target.y}
            x2={geometry.endpoint.x}
            y2={geometry.endpoint.y}
            className="component-preview-line component-preview-y"
          />
          <circle
            cx={geometry.target.x}
            cy={geometry.target.y}
            r={12 - proximity * 4}
            className="component-target-ring"
          />
          <circle
            cx={geometry.target.x}
            cy={geometry.target.y}
            r="4.8"
            className="component-target-dot"
          />
        </g>
      )}

      {armed && (
        <g className="component-puzzle-handle-group">
          <line
            x1={base.x}
            y1={base.y}
            x2={handle.x}
            y2={handle.y}
            className="component-puzzle-tether"
            pointerEvents="none"
          />
          {snapping ? (
            <circle
              cx={geometry.target.x}
              cy={geometry.target.y}
              r="6.5"
              className="component-puzzle-snap-dot"
              pointerEvents="none"
            />
          ) : (
            <>
              <polygon
                points={diamondPoints(handle, 12)}
                className="component-puzzle-handle"
                role="button"
                tabIndex={0}
                aria-label="PULLハンドル。ドラッグしてベクトル成分の接合点を探す"
                onPointerDown={handlePointerDown}
                onPointerMove={handlePointerMove}
                onPointerUp={handlePointerUp}
                onPointerCancel={handlePointerCancel}
                onKeyDown={handleKeyDown}
              />
              {!dragging && (
                <text
                  x={handle.x + 16}
                  y={handle.y - 13}
                  className="component-puzzle-label"
                  pointerEvents="none"
                >
                  PULL
                </text>
              )}
            </>
          )}
        </g>
      )}
    </g>,
    geometry.svg,
  )

  const toolbarPortal = geometry.toolbar && armed
    ? createPortal(
        <span className="gateway-whisper component-puzzle-whisper" aria-hidden="true">
          {dragging ? 'find the white joint' : '◇ find the joint'}
        </span>,
        geometry.toolbar,
      )
    : null

  return (
    <>
      {svgPortal}
      {toolbarPortal}
    </>
  )
}
