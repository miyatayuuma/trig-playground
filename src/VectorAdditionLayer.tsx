import {
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type PointerEvent as ReactPointerEvent,
} from 'react'
import {
  addVectors,
  clampVectorMagnitude,
  DEFAULT_SECOND_VECTOR,
  isSecondVectorGatewayGesture,
  screenPointToVector,
  SECOND_VECTOR_MAX_MAGNITUDE,
  secondVectorPullProgress,
  vectorComponentLabel,
  vectorMagnitude,
  type Point2,
} from './vectorModel'

const VIEW_WIDTH = 760
const VIEW_HEIGHT = 430

type AdditionConcept = 'vector-components' | 'vector-addition'

type Props = {
  concept: AdditionConcept
  vector: Point2
  origin: Point2
  xBasisPoint: Point2
  yBasisPoint: Point2
  disabled: boolean
  onEnter: () => void
}

type PullDrag = {
  pointerId: number
  start: Point2
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

export default function VectorAdditionLayer({
  concept,
  vector,
  origin,
  xBasisPoint,
  yBasisPoint,
  disabled,
  onEnter,
}: Props) {
  const [secondVector, setSecondVector] = useState<Point2>(DEFAULT_SECOND_VECTOR)
  const [previewVector, setPreviewVector] = useState<Point2 | null>(null)
  const [previewProgress, setPreviewProgress] = useState(0)
  const pullRef = useRef<PullDrag | null>(null)

  const displayedSecond = previewVector ?? secondVector
  const secondScreen = vectorToScreen(displayedSecond, origin, xBasisPoint, yBasisPoint)
  const firstScreen = vectorToScreen(vector, origin, xBasisPoint, yBasisPoint)
  const sum = addVectors(vector, displayedSecond)
  const sumScreen = vectorToScreen(sum, origin, xBasisPoint, yBasisPoint)
  const additionVisible = concept === 'vector-addition'
  const previewVisible = concept === 'vector-components' && previewVector !== null

  const vectorFromPointer = (svg: SVGSVGElement, clientX: number, clientY: number) => {
    const screenPoint = clientToSvgPoint(svg, clientX, clientY)
    return clampVectorMagnitude(
      screenPointToVector(screenPoint, origin, xBasisPoint, yBasisPoint),
      SECOND_VECTOR_MAX_MAGNITUDE,
    )
  }

  const handleGatewayPointerDown = (event: ReactPointerEvent<SVGCircleElement>) => {
    if (disabled || concept !== 'vector-components') return
    event.stopPropagation()
    const svg = event.currentTarget.ownerSVGElement
    if (!svg) return
    pullRef.current = {
      pointerId: event.pointerId,
      start: clientToSvgPoint(svg, event.clientX, event.clientY),
    }
    event.currentTarget.setPointerCapture(event.pointerId)
  }

  const handleGatewayPointerMove = (event: ReactPointerEvent<SVGCircleElement>) => {
    const drag = pullRef.current
    if (!drag || drag.pointerId !== event.pointerId || disabled) return
    event.stopPropagation()
    const svg = event.currentTarget.ownerSVGElement
    if (!svg) return
    const point = clientToSvgPoint(svg, event.clientX, event.clientY)
    setPreviewProgress(secondVectorPullProgress(drag.start, point))
    setPreviewVector(vectorFromPointer(svg, event.clientX, event.clientY))
  }

  const finishGatewayPull = (event: ReactPointerEvent<SVGCircleElement>) => {
    const drag = pullRef.current
    pullRef.current = null
    event.stopPropagation()
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId)
    }

    const svg = event.currentTarget.ownerSVGElement
    if (!drag || drag.pointerId !== event.pointerId || !svg || disabled) {
      setPreviewVector(null)
      setPreviewProgress(0)
      return
    }

    const end = clientToSvgPoint(svg, event.clientX, event.clientY)
    const candidate = vectorFromPointer(svg, event.clientX, event.clientY)
    if (
      isSecondVectorGatewayGesture(drag.start, end, origin)
      && vectorMagnitude(candidate) >= 0.25
    ) {
      setSecondVector(candidate)
      setPreviewVector(null)
      setPreviewProgress(0)
      onEnter()
      return
    }

    setPreviewVector(null)
    setPreviewProgress(0)
  }

  const cancelGatewayPull = (event: ReactPointerEvent<SVGCircleElement>) => {
    event.stopPropagation()
    pullRef.current = null
    setPreviewVector(null)
    setPreviewProgress(0)
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId)
    }
  }

  const handleSecondPointerDown = (event: ReactPointerEvent<SVGCircleElement>) => {
    if (disabled || !additionVisible) return
    event.stopPropagation()
    event.currentTarget.setPointerCapture(event.pointerId)
  }

  const handleSecondPointerMove = (event: ReactPointerEvent<SVGCircleElement>) => {
    if (!event.currentTarget.hasPointerCapture(event.pointerId) || disabled) return
    event.stopPropagation()
    const svg = event.currentTarget.ownerSVGElement
    if (!svg) return
    setSecondVector(vectorFromPointer(svg, event.clientX, event.clientY))
  }

  const handleSecondPointerUp = (event: ReactPointerEvent<SVGCircleElement>) => {
    event.stopPropagation()
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId)
    }
  }

  const handleSecondKeyDown = (event: ReactKeyboardEvent<SVGCircleElement>) => {
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
    setSecondVector((current) => clampVectorMagnitude({
      x: current.x + delta.x,
      y: current.y + delta.y,
    }, SECOND_VECTOR_MAX_MAGNITUDE))
  }

  const enterWithKeyboard = (event: ReactKeyboardEvent<SVGCircleElement>) => {
    if (event.key !== 'Enter' && event.key !== ' ') return
    event.preventDefault()
    event.stopPropagation()
    setSecondVector(DEFAULT_SECOND_VECTOR)
    onEnter()
  }

  return (
    <g className="vector-addition-extension">
      <defs>
        <marker id="second-vector-arrow" markerWidth="10" markerHeight="10" refX="8" refY="5" orient="auto" markerUnits="strokeWidth">
          <path d="M 0 0 L 10 5 L 0 10 z" className="second-vector-arrowhead" />
        </marker>
        <marker id="sum-vector-arrow" markerWidth="10" markerHeight="10" refX="8" refY="5" orient="auto" markerUnits="strokeWidth">
          <path d="M 0 0 L 10 5 L 0 10 z" className="sum-vector-arrowhead" />
        </marker>
      </defs>

      {concept === 'vector-components' && !disabled && (
        <g className="second-vector-gateway">
          {previewVisible && (
            <g style={{ opacity: 0.3 + previewProgress * 0.7 }} pointerEvents="none">
              <line
                x1={origin.x}
                y1={origin.y}
                x2={secondScreen.x}
                y2={secondScreen.y}
                className="second-vector-preview"
                markerEnd="url(#second-vector-arrow)"
              />
              <circle cx={secondScreen.x} cy={secondScreen.y} r="8" className="second-vector-preview-dot" />
            </g>
          )}
          <circle cx={origin.x} cy={origin.y} r="17" className="second-vector-gateway-ring" pointerEvents="none" />
          <text x={origin.x} y={origin.y + 6} className="second-vector-plus" textAnchor="middle" pointerEvents="none">+</text>
          <circle
            cx={origin.x}
            cy={origin.y}
            r="28"
            className="second-vector-gateway-hit"
            role="button"
            tabIndex={0}
            aria-label="原点のプラスを外へ引いて2本目のベクトルを作る"
            onPointerDown={handleGatewayPointerDown}
            onPointerMove={handleGatewayPointerMove}
            onPointerUp={finishGatewayPull}
            onPointerCancel={cancelGatewayPull}
            onKeyDown={enterWithKeyboard}
          />
        </g>
      )}

      {additionVisible && (
        <g className="vector-addition-layer">
          <g className="addition-parallelogram" pointerEvents="none">
            <line x1={origin.x} y1={origin.y} x2={secondScreen.x} y2={secondScreen.y} className="addition-vector-b" markerEnd="url(#second-vector-arrow)" />
            <line x1={firstScreen.x} y1={firstScreen.y} x2={sumScreen.x} y2={sumScreen.y} />
            <line x1={secondScreen.x} y1={secondScreen.y} x2={sumScreen.x} y2={sumScreen.y} />
            <line x1={origin.x} y1={origin.y} x2={sumScreen.x} y2={sumScreen.y} className="addition-vector-sum" markerEnd="url(#sum-vector-arrow)" />
            <text x={firstScreen.x + 11} y={firstScreen.y - 10} className="addition-label addition-label-a">A</text>
            <text x={secondScreen.x + 11} y={secondScreen.y - 10} className="addition-label addition-label-b">B</text>
            <text x={sumScreen.x + 12} y={sumScreen.y - 12} className="addition-label addition-label-sum">A + B</text>
            <text x="28" y="404" className="addition-equation">
              A + B = ({vectorComponentLabel(sum.x)}, {vectorComponentLabel(sum.y)})
            </text>
          </g>

          <g className="second-vector-endpoint-control">
            <circle cx={secondScreen.x} cy={secondScreen.y} r="11" className="second-vector-endpoint-ring" pointerEvents="none" />
            <circle
              cx={secondScreen.x}
              cy={secondScreen.y}
              r="27"
              className="second-vector-endpoint-hit"
              role="slider"
              tabIndex={0}
              aria-label="2本目のベクトルBの先端。ドラッグして向きと長さを変更"
              aria-valuetext={`x ${vectorComponentLabel(secondVector.x)}, y ${vectorComponentLabel(secondVector.y)}, r ${vectorMagnitude(secondVector).toFixed(2)}`}
              onPointerDown={handleSecondPointerDown}
              onPointerMove={handleSecondPointerMove}
              onPointerUp={handleSecondPointerUp}
              onPointerCancel={handleSecondPointerUp}
              onKeyDown={handleSecondKeyDown}
            />
          </g>
        </g>
      )}
    </g>
  )
}
