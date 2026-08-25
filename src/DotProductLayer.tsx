import {
  useEffect,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type PointerEvent as ReactPointerEvent,
} from 'react'
import {
  clampVectorMagnitude,
  dotProduct,
  isOrthogonalTargetHit,
  isProjectionDropReady,
  nearestPerpendicularVector,
  ORTHOGONAL_TARGET_DWELL_MS,
  orthogonalTargetProgress,
  projectVectorOnto,
  projectionDropProgress,
  screenPointToVector,
  SECOND_VECTOR_MAX_MAGNITUDE,
  targetDwellProgress,
  vectorCosine,
  vectorMagnitude,
  type Point2,
} from './vectorModel'

const VIEW_WIDTH = 760
const VIEW_HEIGHT = 430

type Stage = 'gateway' | 'active' | 'basis'

type DropDrag = {
  pointerId: number
}

export type DotProductVisualState = {
  points: Point2[]
  vectorB: Point2
  projection: Point2
  dot: number
  cosine: number
  projectionLength: number
  orthogonalTarget: boolean
  orthogonalProgress: number
  orthogonalDwell: number
  basisLocked: boolean
}

type Props = {
  stage: Stage
  vectorA: Point2
  vectorB: Point2
  origin: Point2
  xBasisPoint: Point2
  yBasisPoint: Point2
  onEnter: () => void
  onVectorBChange: (value: Point2) => void
  onOrthogonalLock: (snapped: Point2) => void
  onVisualState: (state: DotProductVisualState) => void
}

const clientToSvgPoint = (svg: SVGSVGElement, clientX: number, clientY: number): Point2 => {
  const rect = svg.getBoundingClientRect()
  if (rect.width <= 0 || rect.height <= 0) return { x: 0, y: 0 }
  return {
    x: ((clientX - rect.left) / rect.width) * VIEW_WIDTH,
    y: ((clientY - rect.top) / rect.height) * VIEW_HEIGHT,
  }
}

const vectorToScreen = (
  vector: Point2,
  origin: Point2,
  xBasisPoint: Point2,
  yBasisPoint: Point2,
): Point2 => {
  const xBasis = { x: xBasisPoint.x - origin.x, y: xBasisPoint.y - origin.y }
  const yBasis = { x: yBasisPoint.x - origin.x, y: yBasisPoint.y - origin.y }
  return {
    x: origin.x + vector.x * xBasis.x + vector.y * yBasis.x,
    y: origin.y + vector.x * xBasis.y + vector.y * yBasis.y,
  }
}

const screenUnit = (from: Point2, to: Point2): Point2 => {
  const x = to.x - from.x
  const y = to.y - from.y
  const length = Math.hypot(x, y)
  return length < 1e-6 ? { x: 1, y: 0 } : { x: x / length, y: y / length }
}

const lerpPoint = (from: Point2, to: Point2, progress: number): Point2 => ({
  x: from.x + (to.x - from.x) * progress,
  y: from.y + (to.y - from.y) * progress,
})

const addScreen = (origin: Point2, a: Point2, aScale: number, b: Point2, bScale: number): Point2 => ({
  x: origin.x + (a.x - origin.x) * aScale + (b.x - origin.x) * bScale,
  y: origin.y + (a.y - origin.y) * aScale + (b.y - origin.y) * bScale,
})

export default function DotProductLayer({
  stage,
  vectorA,
  vectorB,
  origin,
  xBasisPoint,
  yBasisPoint,
  onEnter,
  onVectorBChange,
  onOrthogonalLock,
  onVisualState,
}: Props) {
  const [dropProgress, setDropProgress] = useState(0)
  const [dropReady, setDropReady] = useState(false)
  const [orthogonalDwell, setOrthogonalDwell] = useState(0)
  const dropRef = useRef<DropDrag | null>(null)

  const firstScreen = vectorToScreen(vectorA, origin, xBasisPoint, yBasisPoint)
  const secondScreen = vectorToScreen(vectorB, origin, xBasisPoint, yBasisPoint)
  const projection = projectVectorOnto(vectorB, vectorA)
  const projectionScreen = vectorToScreen(projection, origin, xBasisPoint, yBasisPoint)
  const dot = dotProduct(vectorA, vectorB)
  const cosine = vectorCosine(vectorA, vectorB)
  const projectionLength = vectorMagnitude(vectorA) < 1e-8 ? 0 : dot / vectorMagnitude(vectorA)
  const shadowPoint = lerpPoint(secondScreen, projectionScreen, dropReady ? 1 : dropProgress)
  const orthogonalProgress = orthogonalTargetProgress(vectorA, vectorB)
  const orthogonalTarget = stage === 'active' && isOrthogonalTargetHit(vectorA, vectorB)
  const basisLocked = stage === 'basis'

  const basisCorners = basisLocked
    ? [
        addScreen(origin, firstScreen, -1.15, secondScreen, -1.15),
        addScreen(origin, firstScreen, 1.15, secondScreen, -1.15),
        addScreen(origin, firstScreen, 1.15, secondScreen, 1.15),
        addScreen(origin, firstScreen, -1.15, secondScreen, 1.15),
      ]
    : []

  useEffect(() => {
    let frame = 0

    if (basisLocked) {
      frame = requestAnimationFrame(() => setOrthogonalDwell(1))
      return () => cancelAnimationFrame(frame)
    }

    if (!orthogonalTarget) {
      frame = requestAnimationFrame(() => setOrthogonalDwell(0))
      return () => cancelAnimationFrame(frame)
    }

    let startedAt: number | null = null
    const tick = (now: number) => {
      if (startedAt === null) startedAt = now
      const progress = targetDwellProgress(now - startedAt, ORTHOGONAL_TARGET_DWELL_MS)
      setOrthogonalDwell(progress)
      if (progress >= 1) {
        onOrthogonalLock(nearestPerpendicularVector(vectorB, vectorA))
        return
      }
      frame = requestAnimationFrame(tick)
    }

    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [basisLocked, onOrthogonalLock, orthogonalTarget, vectorA, vectorB])

  useEffect(() => {
    const points = basisLocked
      ? [origin, firstScreen, secondScreen, ...basisCorners]
      : [origin, firstScreen, secondScreen, projectionScreen]
    onVisualState({
      points,
      vectorB,
      projection,
      dot,
      cosine,
      projectionLength,
      orthogonalTarget,
      orthogonalProgress,
      orthogonalDwell,
      basisLocked,
    })
  }, [basisCorners, basisLocked, cosine, dot, firstScreen, onVisualState, origin, orthogonalDwell, orthogonalProgress, orthogonalTarget, projection, projectionLength, projectionScreen, secondScreen, vectorB])

  const vectorFromPointer = (svg: SVGSVGElement, clientX: number, clientY: number) => {
    const screenPoint = clientToSvgPoint(svg, clientX, clientY)
    return clampVectorMagnitude(
      screenPointToVector(screenPoint, origin, xBasisPoint, yBasisPoint),
      SECOND_VECTOR_MAX_MAGNITUDE,
    )
  }

  const handleGatewayPointerDown = (event: ReactPointerEvent<SVGCircleElement>) => {
    if (stage !== 'gateway') return
    event.stopPropagation()
    dropRef.current = { pointerId: event.pointerId }
    setDropProgress(0)
    setDropReady(false)
    event.currentTarget.setPointerCapture(event.pointerId)
  }

  const handleGatewayPointerMove = (event: ReactPointerEvent<SVGCircleElement>) => {
    const drag = dropRef.current
    if (!drag || drag.pointerId !== event.pointerId || stage !== 'gateway') return
    event.stopPropagation()
    const svg = event.currentTarget.ownerSVGElement
    if (!svg) return
    const point = clientToSvgPoint(svg, event.clientX, event.clientY)
    setDropProgress(projectionDropProgress(point, secondScreen, projectionScreen))
    setDropReady(isProjectionDropReady(point, secondScreen, projectionScreen))
  }

  const finishGateway = (event: ReactPointerEvent<SVGCircleElement>) => {
    event.stopPropagation()
    const drag = dropRef.current
    dropRef.current = null
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId)
    }
    const shouldEnter = drag?.pointerId === event.pointerId && dropReady
    setDropProgress(0)
    setDropReady(false)
    if (shouldEnter) onEnter()
  }

  const cancelGateway = (event: ReactPointerEvent<SVGCircleElement>) => {
    event.stopPropagation()
    dropRef.current = null
    setDropProgress(0)
    setDropReady(false)
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId)
    }
  }

  const enterWithKeyboard = (event: ReactKeyboardEvent<SVGCircleElement>) => {
    if (event.key !== 'Enter' && event.key !== ' ') return
    event.preventDefault()
    event.stopPropagation()
    onEnter()
  }

  const handleVectorBPointerDown = (event: ReactPointerEvent<SVGCircleElement>) => {
    if (stage !== 'active') return
    event.stopPropagation()
    event.currentTarget.setPointerCapture(event.pointerId)
  }

  const handleVectorBPointerMove = (event: ReactPointerEvent<SVGCircleElement>) => {
    if (stage !== 'active' || !event.currentTarget.hasPointerCapture(event.pointerId)) return
    event.stopPropagation()
    const svg = event.currentTarget.ownerSVGElement
    if (!svg) return
    onVectorBChange(vectorFromPointer(svg, event.clientX, event.clientY))
  }

  const handleVectorBPointerUp = (event: ReactPointerEvent<SVGCircleElement>) => {
    event.stopPropagation()
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId)
    }
  }

  const handleVectorBKeyDown = (event: ReactKeyboardEvent<SVGCircleElement>) => {
    if (stage !== 'active') return
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
    onVectorBChange(clampVectorMagnitude({
      x: vectorB.x + delta.x,
      y: vectorB.y + delta.y,
    }, SECOND_VECTOR_MAX_MAGNITUDE))
  }

  const axisUnit = screenUnit(origin, firstScreen)
  const normalUnit = stage === 'basis'
    ? screenUnit(origin, secondScreen)
    : screenUnit(projectionScreen, secondScreen)
  const rightAngleOrigin = stage === 'basis' ? origin : projectionScreen
  const rightAngleSize = stage === 'basis' ? 14 : 10
  const rightAnglePoints = [
    {
      x: rightAngleOrigin.x + axisUnit.x * rightAngleSize,
      y: rightAngleOrigin.y + axisUnit.y * rightAngleSize,
    },
    {
      x: rightAngleOrigin.x + axisUnit.x * rightAngleSize + normalUnit.x * rightAngleSize,
      y: rightAngleOrigin.y + axisUnit.y * rightAngleSize + normalUnit.y * rightAngleSize,
    },
    {
      x: rightAngleOrigin.x + normalUnit.x * rightAngleSize,
      y: rightAngleOrigin.y + normalUnit.y * rightAngleSize,
    },
  ]

  const basisOffsets = [-1, 0, 1]
  const basisSpan = 1.25
  const basisCell = [
    origin,
    firstScreen,
    addScreen(origin, firstScreen, 1, secondScreen, 1),
    secondScreen,
  ]

  return (
    <g className={`dot-product-extension dot-product-${stage}`}>
      <defs>
        <marker id="dot-vector-arrow" markerWidth="10" markerHeight="10" refX="8" refY="5" orient="auto" markerUnits="strokeWidth">
          <path d="M 0 0 L 10 5 L 0 10 z" className="dot-vector-arrowhead" />
        </marker>
      </defs>

      {stage === 'gateway' && (
        <g className={`projection-gateway ${dropReady ? 'is-ready' : ''}`}>
          <circle cx={secondScreen.x} cy={secondScreen.y} r="17" className="projection-gateway-seed" pointerEvents="none" />
          {(dropProgress > 0 || dropReady) && (
            <g className="projection-drop-preview" pointerEvents="none">
              <line x1={secondScreen.x} y1={secondScreen.y} x2={projectionScreen.x} y2={projectionScreen.y} className="projection-drop-guide" />
              <circle cx={projectionScreen.x} cy={projectionScreen.y} r="7" className="projection-drop-foot" />
              <circle cx={shadowPoint.x} cy={shadowPoint.y} r="9" className="projection-shadow" />
            </g>
          )}
          <circle
            cx={secondScreen.x}
            cy={secondScreen.y}
            r="31"
            className="projection-gateway-hit"
            role="button"
            tabIndex={0}
            aria-label="ベクトルBの影をベクトルAへ落として射影を作る"
            onPointerDown={handleGatewayPointerDown}
            onPointerMove={handleGatewayPointerMove}
            onPointerUp={finishGateway}
            onPointerCancel={cancelGateway}
            onKeyDown={enterWithKeyboard}
          />
        </g>
      )}

      {stage === 'active' && (
        <g className={`dot-product-layer ${orthogonalTarget ? 'is-orthogonal-target' : ''}`}>
          <g
            className="orthogonal-target"
            style={{ opacity: 0.08 + orthogonalProgress * 0.92 }}
            pointerEvents="none"
          >
            <circle cx={origin.x} cy={origin.y} r="19" className="orthogonal-target-halo" />
            <circle
              cx={origin.x}
              cy={origin.y}
              r="15"
              pathLength="1"
              className="orthogonal-target-dwell"
              strokeDasharray="1"
              strokeDashoffset={1 - orthogonalDwell}
              transform={`rotate(-90 ${origin.x} ${origin.y})`}
            />
          </g>
          <line x1={origin.x} y1={origin.y} x2={secondScreen.x} y2={secondScreen.y} className="dot-vector-b" markerEnd="url(#dot-vector-arrow)" pointerEvents="none" />
          <line x1={origin.x} y1={origin.y} x2={projectionScreen.x} y2={projectionScreen.y} className="dot-projection-segment" pointerEvents="none" />
          <line x1={secondScreen.x} y1={secondScreen.y} x2={projectionScreen.x} y2={projectionScreen.y} className="dot-perpendicular-guide" pointerEvents="none" />
          <polyline points={rightAnglePoints.map((point) => `${point.x},${point.y}`).join(' ')} className="dot-right-angle" pointerEvents="none" />
          <circle cx={projectionScreen.x} cy={projectionScreen.y} r="6" className="dot-projection-point" pointerEvents="none" />
          <text x={firstScreen.x + 12} y={firstScreen.y - 11} className="dot-label dot-label-a" pointerEvents="none">A</text>
          <text x={secondScreen.x + 12} y={secondScreen.y - 11} className="dot-label dot-label-b" pointerEvents="none">B</text>
          <text
            x={projectionScreen.x + normalUnit.x * -14}
            y={projectionScreen.y + normalUnit.y * -14}
            className="dot-projection-label"
            textAnchor="middle"
            pointerEvents="none"
          >
            projₐ(B)
          </text>
          <circle cx={secondScreen.x} cy={secondScreen.y} r="11" className="dot-vector-endpoint-ring" pointerEvents="none" />
          <circle
            cx={secondScreen.x}
            cy={secondScreen.y}
            r="30"
            className="dot-vector-endpoint-hit"
            role="slider"
            tabIndex={0}
            aria-label="ベクトルBの先端。Aへの射影をゼロにしてAとBを直交させる"
            onPointerDown={handleVectorBPointerDown}
            onPointerMove={handleVectorBPointerMove}
            onPointerUp={handleVectorBPointerUp}
            onPointerCancel={handleVectorBPointerUp}
            onKeyDown={handleVectorBKeyDown}
          />
        </g>
      )}

      {stage === 'basis' && (
        <g className="orthogonal-basis-layer" pointerEvents="none">
          <g className="orthogonal-basis-grid">
            {basisOffsets.map((offset) => {
              const from = addScreen(origin, firstScreen, -basisSpan, secondScreen, offset)
              const to = addScreen(origin, firstScreen, basisSpan, secondScreen, offset)
              return <line key={`a-${offset}`} x1={from.x} y1={from.y} x2={to.x} y2={to.y} />
            })}
            {basisOffsets.map((offset) => {
              const from = addScreen(origin, firstScreen, offset, secondScreen, -basisSpan)
              const to = addScreen(origin, firstScreen, offset, secondScreen, basisSpan)
              return <line key={`b-${offset}`} x1={from.x} y1={from.y} x2={to.x} y2={to.y} />
            })}
          </g>
          <polygon points={basisCell.map((point) => `${point.x},${point.y}`).join(' ')} className="orthogonal-basis-cell" />
          <line x1={origin.x} y1={origin.y} x2={firstScreen.x} y2={firstScreen.y} className="orthogonal-basis-vector basis-vector-a" markerEnd="url(#dot-vector-arrow)" />
          <line x1={origin.x} y1={origin.y} x2={secondScreen.x} y2={secondScreen.y} className="orthogonal-basis-vector basis-vector-b" markerEnd="url(#dot-vector-arrow)" />
          <polyline points={rightAnglePoints.map((point) => `${point.x},${point.y}`).join(' ')} className="orthogonal-basis-right-angle" />
          <circle cx={origin.x} cy={origin.y} r="8" className="orthogonal-basis-origin" />
          <text x={firstScreen.x + 13} y={firstScreen.y - 12} className="orthogonal-basis-label basis-label-a">e₁ = A</text>
          <text x={secondScreen.x + 13} y={secondScreen.y - 12} className="orthogonal-basis-label basis-label-b">e₂ = B</text>
          <text x={origin.x + 21} y={origin.y + 31} className="orthogonal-basis-symbol">A ⟂ B</text>
        </g>
      )}
    </g>
  )
}
