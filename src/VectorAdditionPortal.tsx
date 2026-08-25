import {
  useEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from 'react'
import { createPortal } from 'react-dom'
import VectorAdditionLayer, { type AdditionVisualState } from './VectorAdditionLayer'
import { screenPointToVector, vectorComponentLabel, type Point2 } from './vectorModel'

const VIEW_WIDTH = 760
const VIEW_HEIGHT = 430

type Geometry = {
  svg: SVGSVGElement
  toolbar: HTMLElement | null
  card: HTMLElement | null
  dock: HTMLElement | null
  origin: Point2
  xBasisPoint: Point2
  yBasisPoint: Point2
  vector: Point2
  endpoint: Point2
}

type AdditionDomState = {
  points: Point2[]
  sum: Point2
  unlocked: boolean
}

type ShieldGesture = {
  pointerId: number
  x: number
  y: number
}

const numberAttr = (element: Element, name: string) => Number(element.getAttribute(name) ?? 0)
const ignoreVisualState: (state: AdditionVisualState) => void = () => undefined

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
    dock: document.querySelector<HTMLElement>('.topbar'),
    origin,
    xBasisPoint,
    yBasisPoint,
    vector: screenPointToVector(endpointPoint, origin, xBasisPoint, yBasisPoint),
    endpoint: endpointPoint,
  }
}

const readAdditionState = (geometry: Geometry): AdditionDomState | null => {
  const sumLine = geometry.svg.querySelector<SVGLineElement>('.addition-vector-sum')
  const secondLine = geometry.svg.querySelector<SVGLineElement>('.addition-vector-b')
  const target = geometry.svg.querySelector<SVGCircleElement>('.addition-target-ring')
  if (!sumLine || !secondLine || !target) return null

  const second = { x: numberAttr(secondLine, 'x2'), y: numberAttr(secondLine, 'y2') }
  const sumPoint = { x: numberAttr(sumLine, 'x2'), y: numberAttr(sumLine, 'y2') }
  const targetPoint = { x: numberAttr(target, 'cx'), y: numberAttr(target, 'cy') }
  const sum = screenPointToVector(
    sumPoint,
    geometry.origin,
    geometry.xBasisPoint,
    geometry.yBasisPoint,
  )

  return {
    points: [geometry.origin, geometry.endpoint, second, sumPoint, targetPoint],
    sum,
    unlocked: geometry.svg.querySelector('.vector-addition-layer.is-unlocked') !== null,
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

const sameAdditionState = (a: AdditionDomState | null, b: AdditionDomState | null) => {
  if (!a || !b) return a === b
  if (a.unlocked !== b.unlocked || a.points.length !== b.points.length) return false
  if (Math.abs(a.sum.x - b.sum.x) >= 0.001 || Math.abs(a.sum.y - b.sum.y) >= 0.001) return false
  return a.points.every((point, index) => {
    const other = b.points[index]
    return Math.abs(point.x - other.x) < 0.01 && Math.abs(point.y - other.y) < 0.01
  })
}

export default function VectorAdditionPortal() {
  const [geometry, setGeometry] = useState<Geometry | null>(null)
  const [additionActive, setAdditionActive] = useState(false)
  const [targetSum, setTargetSum] = useState<Point2 | null>(null)
  const [additionUnlocked, setAdditionUnlocked] = useState(false)
  const [additionState, setAdditionState] = useState<AdditionDomState | null>(null)
  const shieldRef = useRef<ShieldGesture | null>(null)

  useEffect(() => {
    let frame = 0
    const refresh = () => {
      cancelAnimationFrame(frame)
      frame = requestAnimationFrame(() => {
        const next = readGeometry()
        setGeometry((current) => sameGeometry(current, next) ? current : next)
        if (!next) {
          setAdditionActive(false)
          setTargetSum(null)
          setAdditionUnlocked(false)
          setAdditionState(null)
          return
        }
        const nextAdditionState = readAdditionState(next)
        setAdditionState((current) => sameAdditionState(current, nextAdditionState) ? current : nextAdditionState)
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
    card.classList.toggle('addition-unlocked', additionUnlocked)
    return () => {
      card.classList.remove('addition-ready', 'addition-active', 'addition-unlocked', 'addition-fit-active')
    }
  }, [additionActive, additionUnlocked, geometry?.card])

  useEffect(() => {
    const svg = geometry?.svg
    const card = geometry?.card
    if (!svg || !card || !additionActive || !additionState) {
      if (svg) {
        svg.style.removeProperty('--addition-fit-scale')
        svg.style.removeProperty('--addition-fit-x')
        svg.style.removeProperty('--addition-fit-y')
      }
      card?.classList.remove('addition-fit-active')
      return
    }

    const paddingX = 56
    const paddingY = 42
    const xs = additionState.points.map((point) => point.x)
    const ys = additionState.points.map((point) => point.y)
    const minX = Math.min(...xs) - paddingX
    const maxX = Math.max(...xs) + paddingX
    const minY = Math.min(...ys) - paddingY
    const maxY = Math.max(...ys) + paddingY
    const width = Math.max(1, maxX - minX)
    const height = Math.max(1, maxY - minY)
    const scale = Math.min(1, 720 / width, 392 / height)
    const contentCenterX = (minX + maxX) / 2
    const contentCenterY = (minY + maxY) / 2
    const shiftXPercent = scale * (VIEW_WIDTH / 2 - contentCenterX) / VIEW_WIDTH * 100
    const shiftYPercent = scale * (VIEW_HEIGHT / 2 - contentCenterY) / VIEW_HEIGHT * 100

    svg.style.setProperty('--addition-fit-scale', scale.toFixed(4))
    svg.style.setProperty('--addition-fit-x', `${shiftXPercent.toFixed(3)}%`)
    svg.style.setProperty('--addition-fit-y', `${shiftYPercent.toFixed(3)}%`)
    card.classList.add('addition-fit-active')

    return () => {
      svg.style.removeProperty('--addition-fit-scale')
      svg.style.removeProperty('--addition-fit-x')
      svg.style.removeProperty('--addition-fit-y')
      card.classList.remove('addition-fit-active')
    }
  }, [additionActive, additionState, geometry?.card, geometry?.svg])

  if (!geometry) return null

  const holeRadius = 34
  const left = Math.max(0, geometry.endpoint.x - holeRadius)
  const right = Math.min(VIEW_WIDTH, geometry.endpoint.x + holeRadius)
  const top = Math.max(0, geometry.endpoint.y - holeRadius)
  const bottom = Math.min(VIEW_HEIGHT, geometry.endpoint.y + holeRadius)

  const closeAddition = () => {
    setAdditionActive(false)
    setTargetSum(null)
    setAdditionUnlocked(false)
    setAdditionState(null)
  }

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
    if (Math.hypot(event.clientX - start.x, event.clientY - start.y) < 14) closeAddition()
  }

  const shieldRects = additionActive ? (
    <g className="addition-background-shield">
      <rect x="0" y="0" width={VIEW_WIDTH} height={top} onPointerDown={shieldDown} onPointerUp={shieldUp} />
      <rect x="0" y={bottom} width={VIEW_WIDTH} height={VIEW_HEIGHT - bottom} onPointerDown={shieldDown} onPointerUp={shieldUp} />
      <rect x="0" y={top} width={left} height={Math.max(0, bottom - top)} onPointerDown={shieldDown} onPointerUp={shieldUp} />
      <rect x={right} y={top} width={Math.max(0, VIEW_WIDTH - right)} height={Math.max(0, bottom - top)} onPointerDown={shieldDown} onPointerUp={shieldUp} />
    </g>
  ) : null

  const enterAddition = () => {
    setTargetSum({
      x: geometry.vector.x + 0.58,
      y: geometry.vector.y + 0.46,
    })
    setAdditionUnlocked(false)
    setAdditionActive(true)
  }

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
        targetSum={targetSum}
        unlocked={additionUnlocked}
        onEnter={enterAddition}
        onUnlock={() => setAdditionUnlocked(true)}
        onVisualState={ignoreVisualState}
      />
    </>,
    geometry.svg,
  )

  const toolbarPortal = geometry.toolbar
    ? createPortal(
        additionActive ? (
          <>
            <span className="model-mode addition-mode-label">VECTOR ADDITION</span>
            <span className="gateway-whisper addition-whisper">
              {additionUnlocked ? 'target matched ✓' : 'move A or B · match A+B'}
            </span>
          </>
        ) : (
          <span className="gateway-whisper second-vector-whisper">＋ pull 2nd vector</span>
        ),
        geometry.toolbar,
      )
    : null

  const dockPortal = geometry.dock && additionActive && additionState
    ? createPortal(
        <div className={`addition-bottom-status ${additionUnlocked ? 'is-unlocked' : ''}`} aria-live="polite">
          <span>A + B</span>
          <strong>({vectorComponentLabel(additionState.sum.x)}, {vectorComponentLabel(additionState.sum.y)})</strong>
          <small>{additionUnlocked ? 'TARGET MATCHED' : 'match the glowing target'}</small>
        </div>,
        geometry.dock,
      )
    : null

  const backPortal = geometry.card && additionActive
    ? createPortal(
        <button
          type="button"
          className="addition-back"
          aria-label="ベクトル成分表示に戻る"
          title="VECTOR COMPONENTSへ戻る"
          onClick={closeAddition}
        >
          <span aria-hidden="true">‹</span>
        </button>,
        geometry.card,
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
