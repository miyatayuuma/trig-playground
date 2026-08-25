import {
  useEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from 'react'
import { createPortal } from 'react-dom'
import { setMotionPaused } from './motionClock'
import {
  isRadiusTraceComplete,
  isRadiusTraceStart,
  radiusTraceProgress,
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
}

type TraceGesture = {
  pointerId: number
  origin: Point2
  endpoint: Point2
}

type TraceGeometry = Pick<TraceGesture, 'origin' | 'endpoint'>
type DefinitionLabel = { x: number; y: number; anchor: 'start' | 'middle' | 'end' }

const numberAttr = (element: Element, name: string) => Number(element.getAttribute(name) ?? 0)
const pointDistance = (a: Point2, b: Point2) => Math.hypot(a.x - b.x, a.y - b.y)

const clientToSvgPoint = (svg: SVGSVGElement, clientX: number, clientY: number): Point2 => {
  const rect = svg.getBoundingClientRect()
  if (rect.width <= 0 || rect.height <= 0) return { x: 0, y: 0 }
  return {
    x: ((clientX - rect.left) / rect.width) * VIEW_WIDTH,
    y: ((clientY - rect.top) / rect.height) * VIEW_HEIGHT,
  }
}

const readGeometry = (): Geometry | null => {
  const originElement = document.querySelector<SVGCircleElement>('.vector-gateway-origin')
  const svg = originElement?.ownerSVGElement
  if (!originElement || !svg) return null

  const endpointElement = svg.querySelector<SVGCircleElement>('.circle-plane-details .box-current')
  if (!endpointElement) return null

  return {
    svg,
    card: document.querySelector<HTMLElement>('.model-card'),
    toolbar: document.querySelector<HTMLElement>('.model-toolbar'),
    origin: {
      x: numberAttr(originElement, 'cx'),
      y: numberAttr(originElement, 'cy'),
    },
    endpoint: {
      x: numberAttr(endpointElement, 'cx'),
      y: numberAttr(endpointElement, 'cy'),
    },
  }
}

const sameGeometry = (a: Geometry | null, b: Geometry | null) => {
  if (!a || !b) return a === b
  return a.svg === b.svg
    && pointDistance(a.origin, b.origin) < 0.01
    && pointDistance(a.endpoint, b.endpoint) < 0.01
}

const dispatchGatewayEnter = () => {
  const gateway = document.querySelector<SVGCircleElement>('.vector-gateway-origin')
  if (!gateway) return
  gateway.dispatchEvent(new KeyboardEvent('keydown', {
    key: 'Enter',
    code: 'Enter',
    bubbles: true,
  }))
}

const dispatchBackToBox = (svg: SVGSVGElement) => {
  svg.dispatchEvent(new KeyboardEvent('keydown', {
    key: 'Enter',
    code: 'Enter',
    bubbles: true,
  }))
}

const definitionLabels = (origin: Point2, endpoint: Point2) => {
  const dx = endpoint.x - origin.x
  const dy = endpoint.y - origin.y
  const radius = Math.max(1, Math.hypot(dx, dy))
  const elbow = { x: endpoint.x, y: origin.y }
  const rightSide = dx >= 0

  const cos: DefinitionLabel = {
    x: origin.x + dx * 0.5,
    y: origin.y + (dy <= 0 ? 24 : -14),
    anchor: 'middle',
  }
  const sin: DefinitionLabel = {
    x: endpoint.x + (rightSide ? -14 : 14),
    y: origin.y + dy * 0.5,
    anchor: rightSide ? 'end' : 'start',
  }
  const coordinate: DefinitionLabel = {
    x: endpoint.x - (dx / radius) * 38,
    y: endpoint.y - (dy / radius) * 38 + 5,
    anchor: rightSide ? 'end' : 'start',
  }

  return { elbow, cos, sin, coordinate }
}

export default function UnitCircleGatewayPortal() {
  const [geometry, setGeometry] = useState<Geometry | null>(null)
  const [traceProgress, setTraceProgress] = useState(0)
  const [traceGeometry, setTraceGeometry] = useState<TraceGeometry | null>(null)
  const [tracing, setTracing] = useState(false)
  const traceRef = useRef<TraceGesture | null>(null)

  useEffect(() => {
    let frame = 0
    const refresh = () => {
      cancelAnimationFrame(frame)
      frame = requestAnimationFrame(() => {
        const next = readGeometry()
        setGeometry((current) => sameGeometry(current, next) ? current : next)
      })
    }

    refresh()
    const observer = new MutationObserver(refresh)
    observer.observe(document.body, {
      subtree: true,
      childList: true,
      attributes: true,
      attributeFilter: ['class', 'cx', 'cy'],
    })

    return () => {
      observer.disconnect()
      cancelAnimationFrame(frame)
      setMotionPaused(false)
    }
  }, [])

  useEffect(() => {
    const card = geometry?.card
    if (!card) return undefined
    card.classList.add('unit-circle-gateway-active')
    return () => {
      card.classList.remove('unit-circle-gateway-active', 'circle-tracing')
      setMotionPaused(false)
    }
  }, [geometry?.card])

  const finishTrace = () => {
    traceRef.current = null
    setTracing(false)
    setTraceProgress(1)
    setTraceGeometry(null)
    geometry?.card?.classList.remove('circle-tracing')
    setMotionPaused(false)
    dispatchGatewayEnter()
  }

  const cancelTrace = () => {
    traceRef.current = null
    setTracing(false)
    setTraceProgress(0)
    setTraceGeometry(null)
    geometry?.card?.classList.remove('circle-tracing')
    setMotionPaused(false)
  }

  if (!geometry) return null

  const tracedEndpoint = traceGeometry?.endpoint ?? geometry.endpoint
  const tracedOrigin = traceGeometry?.origin ?? geometry.origin
  const progressPoint = {
    x: tracedOrigin.x + (tracedEndpoint.x - tracedOrigin.x) * traceProgress,
    y: tracedOrigin.y + (tracedEndpoint.y - tracedOrigin.y) * traceProgress,
  }
  const labels = definitionLabels(geometry.origin, geometry.endpoint)

  const handlePointerDown = (event: ReactPointerEvent<SVGRectElement>) => {
    event.stopPropagation()
    const point = clientToSvgPoint(geometry.svg, event.clientX, event.clientY)
    if (!isRadiusTraceStart(point, geometry.origin)) return

    const snapshot = {
      origin: geometry.origin,
      endpoint: geometry.endpoint,
    }
    traceRef.current = {
      pointerId: event.pointerId,
      ...snapshot,
    }
    setTraceGeometry(snapshot)
    setTraceProgress(0)
    setTracing(true)
    geometry.card?.classList.add('circle-tracing')
    setMotionPaused(true)
    event.currentTarget.setPointerCapture(event.pointerId)
  }

  const handlePointerMove = (event: ReactPointerEvent<SVGRectElement>) => {
    const trace = traceRef.current
    if (!trace || trace.pointerId !== event.pointerId) return
    event.stopPropagation()

    const point = clientToSvgPoint(geometry.svg, event.clientX, event.clientY)
    const nextProgress = radiusTraceProgress(point, trace.origin, trace.endpoint)
    setTraceProgress(nextProgress)

    if (!isRadiusTraceComplete(point, trace.origin, trace.endpoint)) return

    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId)
    }
    finishTrace()
  }

  const handlePointerUp = (event: ReactPointerEvent<SVGRectElement>) => {
    event.stopPropagation()
    const trace = traceRef.current
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId)
    }
    if (!trace || trace.pointerId !== event.pointerId) return
    cancelTrace()
  }

  const handlePointerCancel = (event: ReactPointerEvent<SVGRectElement>) => {
    event.stopPropagation()
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId)
    }
    cancelTrace()
  }

  const svgPortal = createPortal(
    <g className={`circle-trace-gateway ${tracing ? 'is-tracing' : ''}`}>
      <g className="unit-circle-component-guides" pointerEvents="none" aria-hidden="true">
        <line
          x1={geometry.origin.x}
          y1={geometry.origin.y}
          x2={labels.elbow.x}
          y2={labels.elbow.y}
          className="unit-circle-component unit-circle-component-cos"
        />
        <line
          x1={labels.elbow.x}
          y1={labels.elbow.y}
          x2={geometry.endpoint.x}
          y2={geometry.endpoint.y}
          className="unit-circle-component unit-circle-component-sin"
        />
        <circle cx={labels.elbow.x} cy={labels.elbow.y} r="3.6" className="unit-circle-component-elbow" />
      </g>
      <g className="unit-circle-definition-labels" pointerEvents="none" aria-hidden="true">
        <text
          x={labels.sin.x}
          y={labels.sin.y}
          textAnchor={labels.sin.anchor}
          className="unit-circle-definition-label unit-circle-definition-label-sin"
        >
          sin θ
        </text>
        <text
          x={labels.cos.x}
          y={labels.cos.y}
          textAnchor={labels.cos.anchor}
          className="unit-circle-definition-label unit-circle-definition-label-cos"
        >
          cos θ
        </text>
        <text
          x={labels.coordinate.x}
          y={labels.coordinate.y}
          textAnchor={labels.coordinate.anchor}
          className="unit-circle-coordinate-definition"
        >
          (cos θ, sin θ)
        </text>
      </g>
      <line
        x1={geometry.origin.x}
        y1={geometry.origin.y}
        x2={geometry.endpoint.x}
        y2={geometry.endpoint.y}
        className="circle-trace-halo"
        pointerEvents="none"
      />
      {!tracing && (
        <line
          x1={geometry.origin.x}
          y1={geometry.origin.y}
          x2={geometry.endpoint.x}
          y2={geometry.endpoint.y}
          className="circle-trace-flow"
          pointerEvents="none"
        />
      )}
      {tracing && traceProgress > 0 && (
        <>
          <line
            x1={tracedOrigin.x}
            y1={tracedOrigin.y}
            x2={progressPoint.x}
            y2={progressPoint.y}
            className="circle-trace-progress"
            markerEnd={traceProgress > 0.72 ? 'url(#vector-arrow)' : undefined}
            pointerEvents="none"
          />
          <circle
            cx={progressPoint.x}
            cy={progressPoint.y}
            r="7"
            className="circle-trace-progress-dot"
            pointerEvents="none"
          />
        </>
      )}
      <rect
        x="0"
        y="0"
        width={VIEW_WIDTH}
        height={VIEW_HEIGHT}
        className="circle-trace-shield"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerCancel}
      />
    </g>,
    geometry.svg,
  )

  const toolbarPortal = geometry.toolbar
    ? createPortal(
        <span className="gateway-whisper circle-trace-whisper" aria-hidden="true">trace the light →</span>,
        geometry.toolbar,
      )
    : null

  const backPortal = geometry.card
    ? createPortal(
        <button
          className="unit-circle-back"
          type="button"
          aria-label="ボックス表示に戻る"
          title="BOXへ戻る"
          onClick={() => {
            cancelTrace()
            dispatchBackToBox(geometry.svg)
          }}
        >
          <span aria-hidden="true">↩</span>
        </button>,
        geometry.card,
      )
    : null

  return (
    <>
      {svgPortal}
      {toolbarPortal}
      {backPortal}
    </>
  )
}
