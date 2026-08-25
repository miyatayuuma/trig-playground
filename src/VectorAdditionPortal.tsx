import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from 'react'
import { createPortal } from 'react-dom'
import DotProductLayer, { type DotProductVisualState } from './DotProductLayer'
import VectorAdditionLayer, { type AdditionVisualState } from './VectorAdditionLayer'
import {
  addVectors,
  additionPuzzleSecondVector,
  screenPointToVector,
  vectorComponentLabel,
  type Point2,
} from './vectorModel'

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
  secondVector: Point2
  unlocked: boolean
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
  const secondVector = screenPointToVector(
    second,
    geometry.origin,
    geometry.xBasisPoint,
    geometry.yBasisPoint,
  )

  return {
    points: [geometry.origin, geometry.endpoint, second, sumPoint, targetPoint],
    sum,
    secondVector,
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
  if (Math.abs(a.secondVector.x - b.secondVector.x) >= 0.001 || Math.abs(a.secondVector.y - b.secondVector.y) >= 0.001) return false
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
  const [additionVisual, setAdditionVisual] = useState<AdditionVisualState | null>(null)
  const [dotProductActive, setDotProductActive] = useState(false)
  const [dotVectorB, setDotVectorB] = useState<Point2 | null>(null)
  const [dotState, setDotState] = useState<DotProductVisualState | null>(null)
  const shieldRef = useRef<ShieldGesture | null>(null)
  const unlockAddition = useCallback(() => setAdditionUnlocked(true), [])

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
          setAdditionVisual(null)
          setDotProductActive(false)
          setDotVectorB(null)
          setDotState(null)
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
    card.classList.toggle('dot-product-active', dotProductActive)
    card.classList.toggle('dot-product-gateway', additionUnlocked && !dotProductActive)
    return () => {
      card.classList.remove(
        'addition-ready',
        'addition-active',
        'addition-unlocked',
        'addition-fit-active',
        'dot-product-active',
        'dot-product-gateway',
      )
    }
  }, [additionActive, additionUnlocked, dotProductActive, geometry?.card])

  useEffect(() => {
    const svg = geometry?.svg
    const card = geometry?.card
    const fitPoints = dotProductActive && dotState ? dotState.points : additionState?.points
    if (!svg || !card || !additionActive || !fitPoints) {
      if (svg) {
        svg.style.removeProperty('--addition-fit-scale')
        svg.style.removeProperty('--addition-fit-x')
        svg.style.removeProperty('--addition-fit-y')
      }
      card?.classList.remove('addition-fit-active')
      return
    }

    const paddingX = dotProductActive ? 64 : 56
    const paddingY = dotProductActive ? 50 : 42
    const xs = fitPoints.map((point) => point.x)
    const ys = fitPoints.map((point) => point.y)
    const minX = Math.min(...xs) - paddingX
    const maxX = Math.max(...xs) + paddingX
    const minY = Math.min(...ys) - paddingY
    const maxY = Math.max(...ys) + paddingY
    const width = Math.max(1, maxX - minX)
    const height = Math.max(1, maxY - minY)
    const maxScale = dotProductActive ? 1.08 : 1
    const scale = Math.min(maxScale, 720 / width, 392 / height)
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
  }, [additionActive, additionState?.points, dotProductActive, dotState, geometry?.card, geometry?.svg])

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
    setAdditionVisual(null)
    setDotProductActive(false)
    setDotVectorB(null)
    setDotState(null)
  }

  const closeDotProduct = () => {
    setDotProductActive(false)
    setDotVectorB(null)
    setDotState(null)
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

  const shieldRects = additionActive && !dotProductActive ? (
    <g className="addition-background-shield">
      <rect x="0" y="0" width={VIEW_WIDTH} height={top} onPointerDown={shieldDown} onPointerUp={shieldUp} />
      <rect x="0" y={bottom} width={VIEW_WIDTH} height={VIEW_HEIGHT - bottom} onPointerDown={shieldDown} onPointerUp={shieldUp} />
      <rect x="0" y={top} width={left} height={Math.max(0, bottom - top)} onPointerDown={shieldDown} onPointerUp={shieldUp} />
      <rect x={right} y={top} width={Math.max(0, VIEW_WIDTH - right)} height={Math.max(0, bottom - top)} onPointerDown={shieldDown} onPointerUp={shieldUp} />
    </g>
  ) : null

  const enterAddition = () => {
    const requiredSecond = additionPuzzleSecondVector(geometry.vector)
    setTargetSum(addVectors(geometry.vector, requiredSecond))
    setAdditionUnlocked(false)
    setDotProductActive(false)
    setDotVectorB(null)
    setDotState(null)
    setAdditionActive(true)
  }

  const gatewayVectorB = additionVisual?.secondVector ?? additionState?.secondVector ?? null
  const enterDotProduct = () => {
    if (!gatewayVectorB) return
    setDotVectorB(gatewayVectorB)
    setDotProductActive(true)
  }

  const currentDotVectorB = dotProductActive ? dotVectorB ?? gatewayVectorB : gatewayVectorB

  const svgPortal = createPortal(
    <>
      {shieldRects}
      <VectorAdditionLayer
        concept={additionActive ? 'vector-addition' : 'vector-components'}
        vector={geometry.vector}
        origin={geometry.origin}
        xBasisPoint={geometry.xBasisPoint}
        yBasisPoint={geometry.yBasisPoint}
        disabled={dotProductActive}
        targetSum={targetSum}
        unlocked={additionUnlocked}
        onEnter={enterAddition}
        onUnlock={unlockAddition}
        onVisualState={setAdditionVisual}
      />
      {additionUnlocked && currentDotVectorB && (
        <DotProductLayer
          stage={dotProductActive ? 'active' : 'gateway'}
          vectorA={geometry.vector}
          vectorB={currentDotVectorB}
          origin={geometry.origin}
          xBasisPoint={geometry.xBasisPoint}
          yBasisPoint={geometry.yBasisPoint}
          onEnter={enterDotProduct}
          onVectorBChange={setDotVectorB}
          onVisualState={setDotState}
        />
      )}
    </>,
    geometry.svg,
  )

  const dwellPercent = Math.round((additionVisual?.targetDwell ?? 0) * 100)
  const toolbarPortal = geometry.toolbar
    ? createPortal(
        dotProductActive ? (
          <>
            <span className="model-mode addition-mode-label">DOT PRODUCT</span>
            <span className="gateway-whisper addition-whisper">move B · watch its projection</span>
          </>
        ) : additionActive ? (
          <>
            <span className="model-mode addition-mode-label">VECTOR ADDITION</span>
            <span className="gateway-whisper addition-whisper">
              {additionUnlocked
                ? 'drop B shadow onto A'
                : dwellPercent > 0
                  ? `hold steady ${dwellPercent}%`
                  : 'move A or B · match A+B'}
            </span>
          </>
        ) : (
          <span className="gateway-whisper second-vector-whisper">＋ pull 2nd vector</span>
        ),
        geometry.toolbar,
      )
    : null

  const dotRelation = dotState
    ? Math.abs(dotState.dot) < 0.03
      ? 'orthogonal · A · B = 0'
      : dotState.dot > 0
        ? 'positive projection'
        : 'negative projection'
    : ''

  const dockPortal = geometry.dock && dotProductActive && dotState
    ? createPortal(
        <div className="dot-product-bottom-status" aria-live="polite">
          <span>A · B = |A||B| cos φ</span>
          <strong>{vectorComponentLabel(dotState.dot)}</strong>
          <small>{dotRelation} · cos φ {vectorComponentLabel(dotState.cosine)}</small>
        </div>,
        geometry.dock,
      )
    : geometry.dock && additionActive && additionState
      ? createPortal(
          <div className={`addition-bottom-status ${additionUnlocked ? 'is-unlocked' : ''}`} aria-live="polite">
            <span>A + B</span>
            <strong>({vectorComponentLabel(additionState.sum.x)}, {vectorComponentLabel(additionState.sum.y)})</strong>
            <small>
              {additionUnlocked
                ? 'TARGET LOCKED · drop B shadow onto A'
                : dwellPercent > 0
                  ? `hold inside target · ${dwellPercent}%`
                  : 'match the glowing target'}
            </small>
          </div>,
          geometry.dock,
        )
      : null

  const backPortal = geometry.card && dotProductActive
    ? createPortal(
        <button
          type="button"
          className="addition-back dot-product-back"
          aria-label="ベクトル合成に戻る"
          title="VECTOR ADDITIONへ戻る"
          onClick={closeDotProduct}
        >
          <span aria-hidden="true">‹</span>
        </button>,
        geometry.card,
      )
    : geometry.card && additionActive
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
