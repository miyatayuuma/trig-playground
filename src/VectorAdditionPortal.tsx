import {
  useEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from 'react'
import { createPortal } from 'react-dom'
import VectorAdditionLayer from './VectorAdditionLayer'
import { screenPointToVector, type Point2 } from './vectorModel'

type Geometry = {
  svg: SVGSVGElement
  toolbar: HTMLElement | null
  card: HTMLElement | null
  origin: Point2
  xBasisPoint: Point2
  yBasisPoint: Point2
  vector: Point2
  endpoint: Point2
}

type ShieldGesture = {
  pointerId: number
  x: number
  y: number
}

const numberAttr = (element: Element, name: string) => Number(element.getAttribute(name) ?? 0)

const readGeometry = (): Geometry | null => {
  const svg = document.querySelector<SVGSVGElement>('.camera-svg.is-components-room')
  if (!svg) return null

  const axisLines = svg.querySelectorAll<SVGLineElement>('.vector-grid-axis line')
  const endpoint = svg.querySelector<SVGCircleElement>('.vector-endpoint-ring')
  if (axisLines.length < 2 || !endpoint) return null

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
  const endpointPoint = {
    x: numberAttr(endpoint, 'cx'),
    y: numberAttr(endpoint, 'cy'),
  }

  return {
    svg,
    toolbar: document.querySelector<HTMLElement>('.model-toolbar'),
    card: document.querySelector<HTMLElement>('.model-card'),
    origin,
    xBasisPoint,
    yBasisPoint,
    vector: screenPointToVector(endpointPoint, origin, xBasisPoint, yBasisPoint),
    endpoint: endpointPoint,
  }
}

const sameGeometry = (a: Geometry | null, b: Geometry | null) => {
  if (!a || !b) return a === b
  return a.svg === b.svg
    && Math.abs(a.origin.x - b.origin.x) < 0.01
    && Math.abs(a.origin.y - b.origin.y) < 0.01
    && Math.abs(a.endpoint.x - b.endpoint.x) < 0.01
    && Math.abs(a.endpoint.y - b.endpoint.y) < 0.01
    && Math.abs(a.vector.x - b.vector.x) < 0.001
    && Math.abs(a.vector.y - b.vector.y) < 0.001
}

export default function VectorAdditionPortal() {
  const [geometry, setGeometry] = useState<Geometry | null>(null)
  const [additionActive, setAdditionActive] = useState(false)
  const shieldRef = useRef<ShieldGesture | null>(null)

  useEffect(() => {
    let frame = 0
    const refresh = () => {
      cancelAnimationFrame(frame)
      frame = requestAnimationFrame(() => {
        const next = readGeometry()
        setGeometry((current) => sameGeometry(current, next) ? current : next)
        if (!next) setAdditionActive(false)
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
  }, [])

  useEffect(() => {
    const card = geometry?.card
    if (!card) return undefined
    card.classList.add('addition-ready')
    card.classList.toggle('addition-active', additionActive)
    return () => {
      card.classList.remove('addition-ready')
      card.classList.remove('addition-active')
    }
  }, [additionActive, geometry?.card])

  if (!geometry) return null

  const holeRadius = 34
  const left = Math.max(0, geometry.endpoint.x - holeRadius)
  const right = Math.min(760, geometry.endpoint.x + holeRadius)
  const top = Math.max(0, geometry.endpoint.y - holeRadius)
  const bottom = Math.min(430, geometry.endpoint.y + holeRadius)

  const shieldDown = (event: ReactPointerEvent<SVGRectElement>) => {
    event.stopPropagation()
    shieldRef.current = {
      pointerId: event.pointerId,
      x: event.clientX,
      y: event.clientY,
    }
    event.currentTarget.setPointerCapture(event.pointerId)
  }

  const shieldUp = (event: ReactPointerEvent<SVGRectElement>) => {
    event.stopPropagation()
    const start = shieldRef.current
    shieldRef.current = null
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId)
    }
    if (!start || start.pointerId !== event.pointerId) return
    if (Math.hypot(event.clientX - start.x, event.clientY - start.y) < 14) {
      setAdditionActive(false)
    }
  }

  const shieldRects = additionActive ? (
    <g className="addition-background-shield">
      <rect x="0" y="0" width="760" height={top} onPointerDown={shieldDown} onPointerUp={shieldUp} />
      <rect x="0" y={bottom} width="760" height={430 - bottom} onPointerDown={shieldDown} onPointerUp={shieldUp} />
      <rect x="0" y={top} width={left} height={Math.max(0, bottom - top)} onPointerDown={shieldDown} onPointerUp={shieldUp} />
      <rect x={right} y={top} width={Math.max(0, 760 - right)} height={Math.max(0, bottom - top)} onPointerDown={shieldDown} onPointerUp={shieldUp} />
    </g>
  ) : null

  const svgPortal = createPortal(
    <>
      {shieldRects}
      <VectorAdditionLayer
        concept={additionActive ? 'vector-addition' : 'vector-components'}
        vector={geometry.vector}
        origin={geometry.origin}
        xBasisPoint={geometry.xBasisPoint}
        yBasisPoint={geometry.yBasisPoint}
        disabled={false}
        onEnter={() => setAdditionActive(true)}
      />
    </>,
    geometry.svg,
  )

  const toolbarPortal = geometry.toolbar
    ? createPortal(
        additionActive ? (
          <>
            <span className="model-mode addition-mode-label">VECTOR ADDITION</span>
            <span className="gateway-whisper addition-whisper">drag B · tap background ↩</span>
          </>
        ) : (
          <span className="gateway-whisper second-vector-whisper">＋ pull 2nd vector · tap bg ↩</span>
        ),
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
