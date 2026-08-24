import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type PointerEvent as ReactPointerEvent,
} from 'react'
import {
  degreesToRadians,
  formatRadians,
  nearestEquivalentAngle,
  normalizeRadians,
  radiansToDegrees,
  trigValuesFromRadians,
} from './math'

const TAU = Math.PI * 2
const WAVE_WIDTH = 760
const WAVE_HEIGHT = 300
const WAVE_SPAN = TAU * 1.8
const CURRENT_WAVE_X_RATIO = 0.58
const BOX_DEPTH = 5.2
const BOX_CYCLE_LENGTH = 1.48
const FACE_EXTENT = 1.15
const BOX_CIRCLE_RADIUS = 82
const FACE_TRANSITION_MS = 680
const PLAYBACK_SPEED = 0.7

type ViewMode = 'box' | 'circle' | 'sin' | 'cos'
type FlatView = Exclude<ViewMode, 'box'>
type Point = { x: number; y: number }
type HelixSegment = { d: string; opacity: number }
type FlatGesture = { clientX: number; clientY: number; pointerId: number }

const buildWavePath = (
  fn: (radians: number) => number,
  startRadians: number,
  spanRadians: number,
) => {
  const midY = 142
  const amplitude = 94
  const steps = 320

  return Array.from({ length: steps + 1 }, (_, index) => {
    const ratio = index / steps
    const radians = startRadians + ratio * spanRadians
    const x = ratio * WAVE_WIDTH
    const y = midY - fn(radians) * amplitude
    return `${index === 0 ? 'M' : 'L'} ${x.toFixed(2)} ${y.toFixed(2)}`
  }).join(' ')
}

const formatHalfPiTick = (radians: number) => {
  const units = Math.round(radians / (Math.PI / 2))
  if (units === 0) return '0'

  if (units % 2 === 0) {
    const piUnits = units / 2
    if (piUnits === 1) return 'π'
    if (piUnits === -1) return '−π'
    return `${piUnits}π`.replace('-', '−')
  }

  if (units === 1) return 'π/2'
  if (units === -1) return '−π/2'
  return `${units}π/2`.replace('-', '−')
}

const projectBox = (t: number, x: number, y: number): Point => ({
  x: 135 + t * 86 + x * 82,
  y: 250 - t * 17 - y * 82,
})

const pointsString = (points: Point[]) => points.map((point) => `${point.x},${point.y}`).join(' ')

const buildBoxPath = (
  phase: number,
  projector: (t: number, radians: number) => Point,
) => {
  const steps = 260
  return Array.from({ length: steps + 1 }, (_, index) => {
    const t = (index / steps) * BOX_DEPTH
    const radians = phase - (t / BOX_CYCLE_LENGTH) * TAU
    const point = projector(t, radians)
    return `${index === 0 ? 'M' : 'L'} ${point.x.toFixed(2)} ${point.y.toFixed(2)}`
  }).join(' ')
}

const buildHelixSegments = (phase: number): HelixSegment[] => {
  const segments = 96
  const visibleDepth = BOX_DEPTH * 0.82

  return Array.from({ length: segments }, (_, index) => {
    const t0 = (index / segments) * BOX_DEPTH
    const t1 = ((index + 1) / segments) * BOX_DEPTH
    const radians0 = phase - (t0 / BOX_CYCLE_LENGTH) * TAU
    const radians1 = phase - (t1 / BOX_CYCLE_LENGTH) * TAU
    const start = projectBox(t0, Math.cos(radians0), Math.sin(radians0))
    const end = projectBox(t1, Math.cos(radians1), Math.sin(radians1))
    const fade = Math.max(0, 1 - t0 / visibleDepth)

    return {
      d: `M ${start.x.toFixed(2)} ${start.y.toFixed(2)} L ${end.x.toFixed(2)} ${end.y.toFixed(2)}`,
      opacity: 0.25 * fade * fade,
    }
  })
}

const buildFrontAnglePath = (radians: number) => {
  if (radians < 0.001) return ''

  const steps = Math.max(3, Math.ceil((radians / TAU) * 72))
  return Array.from({ length: steps + 1 }, (_, index) => {
    const angle = (index / steps) * radians
    const point = projectBox(0, Math.cos(angle) * 0.35, Math.sin(angle) * 0.35)
    return `${index === 0 ? 'M' : 'L'} ${point.x.toFixed(2)} ${point.y.toFixed(2)}`
  }).join(' ')
}

const facePoints = (t: number) => [
  projectBox(t, -FACE_EXTENT, -FACE_EXTENT),
  projectBox(t, FACE_EXTENT, -FACE_EXTENT),
  projectBox(t, FACE_EXTENT, FACE_EXTENT),
  projectBox(t, -FACE_EXTENT, FACE_EXTENT),
]

export default function App() {
  const [phase, setPhase] = useState(degreesToRadians(45))
  const [playing, setPlaying] = useState(false)
  const [view, setView] = useState<ViewMode>('box')
  const [transitionTarget, setTransitionTarget] = useState<FlatView | null>(null)
  const [closingFrom, setClosingFrom] = useState<FlatView | null>(null)
  const transitionTimerRef = useRef<number | null>(null)
  const flatGestureRef = useRef<FlatGesture | null>(null)

  const normalizedAngle = normalizeRadians(phase)
  const values = useMemo(() => trigValuesFromRadians(phase), [phase])
  const displayDegrees = radiansToDegrees(normalizedAngle)

  const waveStart = phase - WAVE_SPAN * CURRENT_WAVE_X_RATIO
  const waveEnd = waveStart + WAVE_SPAN
  const sineFlatPath = useMemo(() => buildWavePath(Math.sin, waveStart, WAVE_SPAN), [waveStart])
  const cosineFlatPath = useMemo(() => buildWavePath(Math.cos, waveStart, WAVE_SPAN), [waveStart])
  const waveCursorX = WAVE_WIDTH * CURRENT_WAVE_X_RATIO

  const waveTicks = useMemo(() => {
    const tickStep = Math.PI / 2
    const first = Math.ceil(waveStart / tickStep) * tickStep
    const ticks: Array<{ radians: number; x: number }> = []

    for (let radians = first; radians <= waveEnd + 1e-8; radians += tickStep) {
      ticks.push({
        radians,
        x: ((radians - waveStart) / WAVE_SPAN) * WAVE_WIDTH,
      })
    }

    return ticks
  }, [waveEnd, waveStart])

  const frontAnglePath = buildFrontAnglePath(normalizedAngle)
  const helixSegments = buildHelixSegments(phase)
  const sineProjectionPath = useMemo(
    () => buildBoxPath(phase, (t, radians) => projectBox(t, -FACE_EXTENT, Math.sin(radians))),
    [phase],
  )
  const cosineProjectionPath = useMemo(
    () => buildBoxPath(phase, (t, radians) => projectBox(t, Math.cos(radians), -FACE_EXTENT)),
    [phase],
  )

  const front = facePoints(0)
  const back = facePoints(BOX_DEPTH)
  const sinFace = [front[0], front[3], back[3], back[0]]
  const cosFace = [front[0], front[1], back[1], back[0]]

  const boxCurrent = projectBox(0, values.cos, values.sin)
  const boxCenter = projectBox(0, 0, 0)
  const sinCurrent = projectBox(0, -FACE_EXTENT, values.sin)
  const cosCurrent = projectBox(0, values.cos, -FACE_EXTENT)
  const frontXAxisStart = projectBox(0, -1.02, 0)
  const frontXAxisEnd = projectBox(0, 1.02, 0)
  const frontYAxisStart = projectBox(0, 0, -1.02)
  const frontYAxisEnd = projectBox(0, 0, 1.02)
  const thetaPoint = projectBox(
    0,
    Math.cos(normalizedAngle / 2) * 0.5,
    Math.sin(normalizedAngle / 2) * 0.5,
  )

  const circleCx = 210
  const circleCy = 210
  const circleRadius = 132
  const circlePointX = circleCx + values.cos * circleRadius
  const circlePointY = circleCy - values.sin * circleRadius
  const angleArcRadius = 43
  const arcEndX = circleCx + Math.cos(normalizedAngle) * angleArcRadius
  const arcEndY = circleCy - Math.sin(normalizedAngle) * angleArcRadius
  const largeArc = normalizedAngle > Math.PI ? 1 : 0
  const angleArc = normalizedAngle < 0.001
    ? ''
    : `M ${circleCx + angleArcRadius} ${circleCy} A ${angleArcRadius} ${angleArcRadius} 0 ${largeArc} 0 ${arcEndX} ${arcEndY}`

  useEffect(() => {
    if (!playing) return

    let frame = 0
    let last = performance.now()

    const tick = (now: number) => {
      const deltaSeconds = Math.min((now - last) / 1000, 0.05)
      last = now
      setPhase((current) => current + deltaSeconds * PLAYBACK_SPEED)
      frame = requestAnimationFrame(tick)
    }

    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [playing])

  useEffect(() => () => {
    if (transitionTimerRef.current !== null) window.clearTimeout(transitionTimerRef.current)
  }, [])

  const prefersReducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches
  const isTransitioning = transitionTarget !== null || closingFrom !== null

  const openFace = (nextView: FlatView) => {
    if (isTransitioning || view !== 'box') return

    if (prefersReducedMotion()) {
      setView(nextView)
      return
    }

    setTransitionTarget(nextView)
    transitionTimerRef.current = window.setTimeout(() => {
      setView(nextView)
      setTransitionTarget(null)
      transitionTimerRef.current = null
    }, FACE_TRANSITION_MS)
  }

  const returnToBox = () => {
    if (view === 'box' || isTransitioning) return

    if (prefersReducedMotion()) {
      setView('box')
      return
    }

    setClosingFrom(view)
    transitionTimerRef.current = window.setTimeout(() => {
      setView('box')
      setClosingFrom(null)
      transitionTimerRef.current = null
    }, FACE_TRANSITION_MS)
  }

  const handleFlatPointerDown = (event: ReactPointerEvent<SVGSVGElement>) => {
    if (isTransitioning) return
    flatGestureRef.current = {
      clientX: event.clientX,
      clientY: event.clientY,
      pointerId: event.pointerId,
    }
    event.currentTarget.setPointerCapture(event.pointerId)
  }

  const handleFlatPointerUp = (event: ReactPointerEvent<SVGSVGElement>) => {
    const gesture = flatGestureRef.current
    flatGestureRef.current = null
    if (!gesture || isTransitioning) return

    if (event.currentTarget.hasPointerCapture(gesture.pointerId)) {
      event.currentTarget.releasePointerCapture(gesture.pointerId)
    }

    const dx = event.clientX - gesture.clientX
    const dy = event.clientY - gesture.clientY
    const distance = Math.hypot(dx, dy)
    if (distance < 14 || Math.abs(dx) > 42 || Math.abs(dy) > 42) returnToBox()
  }

  const handleFlatKeyDown = (event: ReactKeyboardEvent<SVGSVGElement>) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      returnToBox()
    }
  }

  const modelStageClass = [
    'model-stage',
    `view-${view}`,
    transitionTarget ? 'is-opening' : '',
    transitionTarget ? `opening-${transitionTarget}` : '',
    closingFrom ? 'is-closing' : '',
    closingFrom ? `closing-${closingFrom}` : '',
  ].filter(Boolean).join(' ')

  const showBox = view === 'box' || closingFrom !== null
  const flatMode: FlatView | null = view === 'box' ? transitionTarget : view
  const modeLabel = closingFrom ? 'BOX' : transitionTarget ? transitionTarget.toUpperCase() : view === 'box' ? 'BOX' : view.toUpperCase()

  const renderFlatView = (mode: FlatView) => {
    const transitionClass = transitionTarget === mode
      ? `is-opening-flat opening-flat-${mode}`
      : closingFrom === mode
        ? `is-closing-flat closing-flat-${mode}`
        : ''

    if (mode === 'circle') {
      return (
        <svg
          className={`flat-svg circle-flat ${transitionClass}`}
          viewBox="0 0 420 420"
          role="button"
          tabIndex={0}
          aria-label={`角度 ${displayDegrees.toFixed(0)} 度の単位円。タップまたはスワイプで箱表示に戻る`}
          onPointerDown={handleFlatPointerDown}
          onPointerUp={handleFlatPointerUp}
          onPointerCancel={() => { flatGestureRef.current = null }}
          onKeyDown={handleFlatKeyDown}
        >
          <g className="grid-lines">
            <line x1="34" y1={circleCy} x2="386" y2={circleCy} />
            <line x1={circleCx} y1="34" x2={circleCx} y2="386" />
          </g>
          <circle cx={circleCx} cy={circleCy} r={circleRadius} className="unit-circle" />
          {angleArc && <path d={angleArc} className="angle-arc" />}
          <line x1={circleCx} y1={circleCy} x2={circlePointX} y2={circlePointY} className="radius-line" />
          <line x1={circleCx} y1={circlePointY} x2={circlePointX} y2={circlePointY} className="projection projection-cos" />
          <line x1={circlePointX} y1={circleCy} x2={circlePointX} y2={circlePointY} className="projection projection-sin" />
          <circle cx={circlePointX} cy={circlePointY} r="8" className="point" />
        </svg>
      )
    }

    const isSin = mode === 'sin'
    const path = isSin ? sineFlatPath : cosineFlatPath
    const activeValue = isSin ? values.sin : values.cos
    const activeY = 142 - activeValue * 94

    return (
      <svg
        className={`flat-svg wave-flat ${mode}-flat ${transitionClass}`}
        viewBox={`0 0 ${WAVE_WIDTH} ${WAVE_HEIGHT}`}
        role="button"
        tabIndex={0}
        aria-label={`${isSin ? 'サイン' : 'コサイン'}の波形。タップまたはスワイプで箱表示に戻る`}
        onPointerDown={handleFlatPointerDown}
        onPointerUp={handleFlatPointerUp}
        onPointerCancel={() => { flatGestureRef.current = null }}
        onKeyDown={handleFlatKeyDown}
      >
        <line x1="0" y1="142" x2={WAVE_WIDTH} y2="142" className="wave-axis" />
        {waveTicks.map((tick) => (
          <g key={tick.radians}>
            <line x1={tick.x} y1="26" x2={tick.x} y2="250" className="wave-grid-line" />
            <text x={tick.x} y="278" className="wave-tick">{formatHalfPiTick(tick.radians)}</text>
          </g>
        ))}
        <path d={path} className={`wave-line ${isSin ? 'sine-wave' : 'cosine-wave'}`} />
        <line x1={waveCursorX} y1="22" x2={waveCursorX} y2="252" className="cursor-line" />
        <circle cx={waveCursorX} cy={activeY} r="7" className={`wave-dot ${isSin ? 'sine-dot' : 'cosine-dot'}`} />
      </svg>
    )
  }

  return (
    <main className="app">
      <header className="topbar">
        <div className="brand">TRIG</div>
        <div className="live-readout" aria-live="polite">
          <strong>{displayDegrees.toFixed(displayDegrees % 1 === 0 ? 0 : 1)}°</strong>
          <span className="mini-value sin-mini">sin {values.sin.toFixed(3)}</span>
          <span className="mini-value cos-mini">cos {values.cos.toFixed(3)}</span>
          <small>{formatRadians(normalizedAngle)}</small>
        </div>
      </header>

      <section className="panel model-card">
        <div className="model-toolbar">
          <span className="model-mode">{modeLabel}</span>
        </div>

        <div className={modelStageClass}>
          {showBox && (
            <svg
              className="box-svg"
              viewBox="20 35 680 340"
              role="img"
              aria-label="円運動とサイン・コサインの投影モデル"
            >
              <polygon points={pointsString(back)} className="box-face box-face-back" />
              <polygon points={pointsString(sinFace)} className={`box-face box-face-sin ${transitionTarget === 'sin' ? 'is-target-face' : ''}`} />
              <polygon points={pointsString(cosFace)} className={`box-face box-face-cos ${transitionTarget === 'cos' ? 'is-target-face' : ''}`} />
              <polygon points={pointsString(front)} className={`box-face box-face-front ${transitionTarget === 'circle' ? 'is-target-face' : ''}`} />

              <path d={sineProjectionPath} className="box-wave box-wave-sin" />

              <g className="box-edges box-edges-back">
                <polyline points={`${back[0].x},${back[0].y} ${back[1].x},${back[1].y} ${back[2].x},${back[2].y} ${back[3].x},${back[3].y} ${back[0].x},${back[0].y}`} />
              </g>
              <g className="box-edges box-edges-depth">
                {front.map((point, index) => (
                  <line key={index} x1={point.x} y1={point.y} x2={back[index].x} y2={back[index].y} />
                ))}
              </g>

              <path d={cosineProjectionPath} className="box-wave box-wave-cos" />
              <g className="box-helix-fade" aria-hidden="true">
                {helixSegments.map((segment, index) => (
                  <path key={index} d={segment.d} className="box-helix-segment" style={{ opacity: segment.opacity }} />
                ))}
              </g>

              <g className="box-front-axes">
                <line x1={frontXAxisStart.x} y1={frontXAxisStart.y} x2={frontXAxisEnd.x} y2={frontXAxisEnd.y} />
                <line x1={frontYAxisStart.x} y1={frontYAxisStart.y} x2={frontYAxisEnd.x} y2={frontYAxisEnd.y} />
              </g>
              <circle cx={boxCenter.x} cy={boxCenter.y} r={BOX_CIRCLE_RADIUS} className="box-circle" />
              {frontAnglePath && <path d={frontAnglePath} className="box-angle-arc" />}
              <line x1={boxCenter.x} y1={boxCenter.y} x2={boxCurrent.x} y2={boxCurrent.y} className="box-radius" />
              <text x={thetaPoint.x + 5} y={thetaPoint.y - 5} className="box-theta">θ</text>

              <line x1={boxCurrent.x} y1={boxCurrent.y} x2={sinCurrent.x} y2={sinCurrent.y} className="box-guide box-guide-sin" />
              <line x1={boxCurrent.x} y1={boxCurrent.y} x2={cosCurrent.x} y2={cosCurrent.y} className="box-guide box-guide-cos" />
              <circle cx={boxCurrent.x} cy={boxCurrent.y} r="6" className="box-current" />
              <circle cx={sinCurrent.x} cy={sinCurrent.y} r="4.5" className="box-dot box-dot-sin" />
              <circle cx={cosCurrent.x} cy={cosCurrent.y} r="4.5" className="box-dot box-dot-cos" />

              <g className="box-edges box-edges-front">
                <polyline points={`${front[0].x},${front[0].y} ${front[1].x},${front[1].y} ${front[2].x},${front[2].y} ${front[3].x},${front[3].y} ${front[0].x},${front[0].y}`} />
              </g>

              <text x={back[3].x + 10} y={back[3].y + 18} className="face-label face-label-sin">sin</text>
              <text x={back[0].x + 28} y={back[0].y - 7} className="face-label face-label-cos">cos</text>

              {view === 'box' && !closingFrom && (
                <>
                  <polygon
                    points={pointsString(front)}
                    className="face-hit face-hit-circle"
                    role="button"
                    tabIndex={0}
                    onClick={() => openFace('circle')}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter' || event.key === ' ') {
                        event.preventDefault()
                        openFace('circle')
                      }
                    }}
                    aria-label="円を平面表示"
                  />
                  <polygon
                    points={pointsString(sinFace)}
                    className="face-hit face-hit-sin"
                    role="button"
                    tabIndex={0}
                    onClick={() => openFace('sin')}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter' || event.key === ' ') {
                        event.preventDefault()
                        openFace('sin')
                      }
                    }}
                    aria-label="サインを平面表示"
                  />
                  <polygon
                    points={pointsString(cosFace)}
                    className="face-hit face-hit-cos"
                    role="button"
                    tabIndex={0}
                    onClick={() => openFace('cos')}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter' || event.key === ' ') {
                        event.preventDefault()
                        openFace('cos')
                      }
                    }}
                    aria-label="コサインを平面表示"
                  />
                </>
              )}
            </svg>
          )}

          {flatMode && renderFlatView(flatMode)}
        </div>
      </section>

      <section className="panel control-panel" aria-label="角度コントロール">
        <input
          className="angle-slider"
          aria-label="角度を動かす"
          type="range"
          min="0"
          max="360"
          step="0.5"
          value={displayDegrees}
          onChange={(event) => {
            setPlaying(false)
            const next = degreesToRadians(Number(event.target.value))
            setPhase((current) => nearestEquivalentAngle(next, current))
          }}
        />
      </section>

      <button
        className={`floating-play ${playing ? 'is-playing' : ''}`}
        type="button"
        onClick={() => setPlaying((current) => !current)}
        aria-label={playing ? '停止' : '再生'}
        aria-pressed={playing}
      >
        <span aria-hidden="true">{playing ? 'Ⅱ' : '▶'}</span>
      </button>
    </main>
  )
}