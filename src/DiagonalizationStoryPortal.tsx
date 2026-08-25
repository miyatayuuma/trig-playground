import { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import {
  addStoryVectors,
  applyEigenTransform,
  crossingPulse,
  diagonalizationStoryFrame,
  interpolateDirection,
  interpolateStoryPoint,
  normalizeStoryVector,
  orientDirectionNear,
  scaleStoryVector,
  type StoryPoint,
} from './diagonalizationStoryModel'

const STORY_DURATION_MS = 7600
const GRID_SPACING = 54
const GRID_SPAN = 3.3
const GRID_OFFSETS = [-3, -2, -1, 0, 1, 2, 3]
const PARTICLE_COEFFICIENTS = [0.65, 1.15, 1.7]

type StoryContext = {
  svg: SVGSVGElement
  card: HTMLElement
  origin: StoryPoint
  baseOne: StoryPoint
  baseTwo: StoryPoint
  eigenOne: StoryPoint
  eigenTwo: StoryPoint
  lambdaOne: number
  lambdaTwo: number
}

type StoryLine = { start: StoryPoint; end: StoryPoint }

const numberAttr = (element: Element, name: string) => Number(element.getAttribute(name) ?? 0)

const lineDirection = (line: SVGLineElement): StoryPoint => normalizeStoryVector({
  x: numberAttr(line, 'x2') - numberAttr(line, 'x1'),
  y: numberAttr(line, 'y2') - numberAttr(line, 'y1'),
})

const lineIntersection = (first: SVGLineElement, second: SVGLineElement): StoryPoint | null => {
  const p = { x: numberAttr(first, 'x1'), y: numberAttr(first, 'y1') }
  const r = {
    x: numberAttr(first, 'x2') - p.x,
    y: numberAttr(first, 'y2') - p.y,
  }
  const q = { x: numberAttr(second, 'x1'), y: numberAttr(second, 'y1') }
  const s = {
    x: numberAttr(second, 'x2') - q.x,
    y: numberAttr(second, 'y2') - q.y,
  }
  const cross = r.x * s.y - r.y * s.x
  if (Math.abs(cross) < 1e-8) return null
  const qMinusP = { x: q.x - p.x, y: q.y - p.y }
  const t = (qMinusP.x * s.y - qMinusP.y * s.x) / cross
  return { x: p.x + r.x * t, y: p.y + r.y * t }
}

const parseLambdas = () => {
  const text = document.querySelector<HTMLElement>('.matrix-bottom-status > strong')?.textContent ?? ''
  const match = text.match(/diag\(\s*([-+]?\d*\.?\d+)\s*,\s*([-+]?\d*\.?\d+)\s*\)/i)
  if (!match) return null
  const lambdaOne = Number(match[1])
  const lambdaTwo = Number(match[2])
  return Number.isFinite(lambdaOne) && Number.isFinite(lambdaTwo)
    ? { lambdaOne, lambdaTwo }
    : null
}

const readContext = (): StoryContext | null => {
  const card = document.querySelector<HTMLElement>('.model-card.diagonalization-active')
  const svg = card?.querySelector<SVGSVGElement>('.camera-svg.is-components-room')
  if (!card || !svg) return null

  const first = svg.querySelector<SVGLineElement>('.eigen-locked-one line')
  const second = svg.querySelector<SVGLineElement>('.eigen-locked-two line')
  const baseAxes = svg.querySelectorAll<SVGLineElement>('.vector-grid-axis line')
  const lambdas = parseLambdas()
  if (!first || !second || baseAxes.length < 2 || !lambdas) return null

  const origin = lineIntersection(first, second)
  if (!origin) return null

  const baseTwo = lineDirection(baseAxes[0])
  const baseOne = lineDirection(baseAxes[1])
  const eigenOne = orientDirectionNear(lineDirection(first), baseOne)
  const eigenTwo = orientDirectionNear(lineDirection(second), baseTwo)

  return {
    svg,
    card,
    origin,
    baseOne,
    baseTwo,
    eigenOne,
    eigenTwo,
    ...lambdas,
  }
}

const sameContext = (a: StoryContext | null, b: StoryContext | null) =>
  a?.svg === b?.svg
  && a?.card === b?.card
  && Math.abs((a?.lambdaOne ?? 0) - (b?.lambdaOne ?? 0)) < 1e-6
  && Math.abs((a?.lambdaTwo ?? 0) - (b?.lambdaTwo ?? 0)) < 1e-6

const toScreen = (origin: StoryPoint, local: StoryPoint): StoryPoint => ({
  x: origin.x + local.x,
  y: origin.y + local.y,
})

const basisPoint = (
  first: StoryPoint,
  firstScale: number,
  second: StoryPoint,
  secondScale: number,
) => addStoryVectors(scaleStoryVector(first, firstScale), scaleStoryVector(second, secondScale))

const transformedLine = (
  first: StoryPoint,
  second: StoryPoint,
  offset: number,
  alongFirst: boolean,
  context: StoryContext,
  progress: number,
): StoryLine => {
  const span = GRID_SPAN * GRID_SPACING
  const cross = offset * GRID_SPACING
  const start = alongFirst
    ? basisPoint(first, -span, second, cross)
    : basisPoint(first, cross, second, -span)
  const end = alongFirst
    ? basisPoint(first, span, second, cross)
    : basisPoint(first, cross, second, span)
  const transformedStart = applyEigenTransform(start, context.eigenOne, context.eigenTwo, context.lambdaOne, context.lambdaTwo)
  const transformedEnd = applyEigenTransform(end, context.eigenOne, context.eigenTwo, context.lambdaOne, context.lambdaTwo)
  return {
    start: interpolateStoryPoint(start, transformedStart, progress),
    end: interpolateStoryPoint(end, transformedEnd, progress),
  }
}

const sourceLine = (
  first: StoryPoint,
  second: StoryPoint,
  offset: number,
  alongFirst: boolean,
): StoryLine => {
  const span = GRID_SPAN * GRID_SPACING
  const cross = offset * GRID_SPACING
  return alongFirst
    ? {
        start: basisPoint(first, -span, second, cross),
        end: basisPoint(first, span, second, cross),
      }
    : {
        start: basisPoint(first, cross, second, -span),
        end: basisPoint(first, cross, second, span),
      }
}

const cellPoints = (first: StoryPoint, second: StoryPoint) => [
  { x: 0, y: 0 },
  scaleStoryVector(first, GRID_SPACING),
  basisPoint(first, GRID_SPACING, second, GRID_SPACING),
  scaleStoryVector(second, GRID_SPACING),
]

const transformPoints = (points: StoryPoint[], context: StoryContext, progress: number) =>
  points.map((point) => interpolateStoryPoint(
    point,
    applyEigenTransform(point, context.eigenOne, context.eigenTwo, context.lambdaOne, context.lambdaTwo),
    progress,
  ))

const pointsString = (points: StoryPoint[], origin: StoryPoint) =>
  points.map((point) => {
    const screen = toScreen(origin, point)
    return `${screen.x},${screen.y}`
  }).join(' ')

const formatScale = (value: number) => `${value < 0 ? '−' : ''}${Math.abs(value).toFixed(2)}`

export default function DiagonalizationStoryPortal() {
  const [context, setContext] = useState<StoryContext | null>(null)
  const [progress, setProgress] = useState(0)
  const [replayNonce, setReplayNonce] = useState(0)
  const startedRef = useRef(0)

  useEffect(() => {
    let frame = 0
    const refresh = () => {
      cancelAnimationFrame(frame)
      frame = requestAnimationFrame(() => {
        const next = readContext()
        setContext((current) => sameContext(current, next) ? current : next)
      })
    }
    refresh()
    const observer = new MutationObserver(refresh)
    observer.observe(document.body, {
      subtree: true,
      childList: true,
      attributes: true,
      characterData: true,
      attributeFilter: ['class'],
    })
    return () => {
      observer.disconnect()
      cancelAnimationFrame(frame)
    }
  }, [])

  useEffect(() => {
    if (!context) return undefined
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (reducedMotion) {
      setProgress(0.88)
      return undefined
    }

    let frame = 0
    startedRef.current = performance.now()
    const tick = (now: number) => {
      setProgress(((now - startedRef.current) % STORY_DURATION_MS) / STORY_DURATION_MS)
      frame = requestAnimationFrame(tick)
    }
    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [context, replayNonce])

  useEffect(() => {
    const card = context?.card
    if (!card) return undefined
    card.classList.add('diagonalization-story-active')
    return () => card.classList.remove('diagonalization-story-active')
  }, [context])

  const frame = diagonalizationStoryFrame(progress)

  const geometry = useMemo(() => {
    if (!context) return null
    const first = interpolateDirection(context.baseOne, context.eigenOne, frame.basisMorph)
    const second = interpolateDirection(context.baseTwo, context.eigenTwo, frame.basisMorph)
    const source = GRID_OFFSETS.flatMap((offset) => [
      sourceLine(first, second, offset, true),
      sourceLine(first, second, offset, false),
    ])
    const transformed = GRID_OFFSETS.flatMap((offset) => [
      transformedLine(first, second, offset, true, context, frame.transformProgress),
      transformedLine(first, second, offset, false, context, frame.transformProgress),
    ])
    const sourceCell = cellPoints(first, second)
    const transformedCell = transformPoints(sourceCell, context, frame.transformProgress)
    return { first, second, source, transformed, sourceCell, transformedCell }
  }, [context, frame.basisMorph, frame.transformProgress])

  if (!context || !geometry) return null

  const isEigenScene = frame.scene === 'eigen' || frame.scene === 'reset'
  const particleProgress = frame.scene === 'eigen' ? frame.transformProgress : 0
  const crossOne = crossingPulse(particleProgress, context.lambdaOne)
  const crossTwo = crossingPulse(particleProgress, context.lambdaTwo)

  const caption = frame.scene === 'world'
    ? 'ONE MOVE DISTORTS THE WHOLE GRID'
    : frame.scene === 'reframe'
      ? 'USE THE TWO DIRECTIONS YOU FOUND'
      : frame.scene === 'reset'
        ? 'SAME TRANSFORM · NEW AXES'
        : 'NOW ONLY TWO SCALES MOVE'

  const svgPortal = createPortal(
    <g className={`matrix-determinant-extension diagonalization-story-layer scene-${frame.scene}`} aria-hidden="true" pointerEvents="none">
      <g className="diag-story-source-grid">
        {geometry.source.map((line, index) => {
          const start = toScreen(context.origin, line.start)
          const end = toScreen(context.origin, line.end)
          return <line key={index} x1={start.x} y1={start.y} x2={end.x} y2={end.y} />
        })}
      </g>

      <g className="diag-story-transformed-grid" style={{ opacity: frame.transformedOpacity }}>
        {geometry.transformed.map((line, index) => {
          const start = toScreen(context.origin, line.start)
          const end = toScreen(context.origin, line.end)
          return <line key={index} x1={start.x} y1={start.y} x2={end.x} y2={end.y} />
        })}
      </g>

      <polygon
        points={pointsString(geometry.sourceCell, context.origin)}
        className="diag-story-source-cell"
      />
      <polygon
        points={pointsString(geometry.transformedCell, context.origin)}
        className="diag-story-live-cell"
        style={{ opacity: frame.transformedOpacity }}
      />

      {isEigenScene && (
        <>
          <line
            x1={toScreen(context.origin, scaleStoryVector(context.eigenOne, -190)).x}
            y1={toScreen(context.origin, scaleStoryVector(context.eigenOne, -190)).y}
            x2={toScreen(context.origin, scaleStoryVector(context.eigenOne, 190)).x}
            y2={toScreen(context.origin, scaleStoryVector(context.eigenOne, 190)).y}
            className="diag-story-axis diag-story-axis-one"
          />
          <line
            x1={toScreen(context.origin, scaleStoryVector(context.eigenTwo, -190)).x}
            y1={toScreen(context.origin, scaleStoryVector(context.eigenTwo, -190)).y}
            x2={toScreen(context.origin, scaleStoryVector(context.eigenTwo, 190)).x}
            y2={toScreen(context.origin, scaleStoryVector(context.eigenTwo, 190)).y}
            className="diag-story-axis diag-story-axis-two"
          />

          {PARTICLE_COEFFICIENTS.flatMap((coefficient) => [
            { direction: context.eigenOne, lambda: context.lambdaOne, coefficient, kind: 'one' as const },
            { direction: context.eigenTwo, lambda: context.lambdaTwo, coefficient, kind: 'two' as const },
          ]).map((particle, index) => {
            const source = scaleStoryVector(particle.direction, particle.coefficient * GRID_SPACING)
            const target = scaleStoryVector(particle.direction, particle.coefficient * GRID_SPACING * particle.lambda)
            const current = interpolateStoryPoint(source, target, particleProgress)
            const sourceScreen = toScreen(context.origin, source)
            const targetScreen = toScreen(context.origin, target)
            const currentScreen = toScreen(context.origin, current)
            return (
              <g key={index} className={`diag-story-particle diag-story-particle-${particle.kind}`}>
                <line x1={sourceScreen.x} y1={sourceScreen.y} x2={targetScreen.x} y2={targetScreen.y} />
                <circle cx={sourceScreen.x} cy={sourceScreen.y} r="4" className="diag-story-particle-source" />
                <circle cx={currentScreen.x} cy={currentScreen.y} r="6" className="diag-story-particle-live" />
              </g>
            )
          })}

          {(crossOne > 0.05 || crossTwo > 0.05) && (
            <circle
              cx={context.origin.x}
              cy={context.origin.y}
              r={18 + Math.max(crossOne, crossTwo) * 17}
              className="diag-story-flip-pulse"
              style={{ opacity: Math.max(crossOne, crossTwo) }}
            />
          )}

          <text
            x={toScreen(context.origin, scaleStoryVector(context.eigenOne, 116)).x}
            y={toScreen(context.origin, scaleStoryVector(context.eigenOne, 116)).y - 10}
            className="diag-story-scale-label diag-story-scale-one"
            style={{ opacity: frame.scaleEmphasis }}
            textAnchor="middle"
          >
            ×{formatScale(context.lambdaOne)}
          </text>
          <text
            x={toScreen(context.origin, scaleStoryVector(context.eigenTwo, 116)).x}
            y={toScreen(context.origin, scaleStoryVector(context.eigenTwo, 116)).y - 10}
            className="diag-story-scale-label diag-story-scale-two"
            style={{ opacity: frame.scaleEmphasis }}
            textAnchor="middle"
          >
            ×{formatScale(context.lambdaTwo)}
          </text>
        </>
      )}
    </g>,
    context.svg,
  )

  const htmlPortal = createPortal(
    <>
      <div className={`diagonalization-story-caption scene-${frame.scene}`} aria-live="polite">
        <span>SAME TRANSFORM</span>
        <strong>{caption}</strong>
      </div>
      <div className={`diagonalization-story-scales ${frame.scaleEmphasis > 0.5 ? 'is-emphasized' : ''}`}>
        <span>v₁ <strong>×{formatScale(context.lambdaOne)}</strong></span>
        <span>v₂ <strong>×{formatScale(context.lambdaTwo)}</strong></span>
      </div>
      <button
        type="button"
        className="diagonalization-story-replay"
        aria-label="同じ変換をもう一度見る"
        onClick={() => {
          setProgress(0)
          setReplayNonce((current) => current + 1)
        }}
      >
        <span aria-hidden="true">↻</span>
      </button>
    </>,
    context.card,
  )

  return <>{svgPortal}{htmlPortal}</>
}
