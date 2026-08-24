import { useEffect, useMemo, useRef, useState } from 'react'
import {
  degreesToRadians,
  formatRadians,
  nearestEquivalentAngle,
  normalizeRadians,
  radiansToDegrees,
  trigValuesFromRadians,
} from './math'

const TAU = Math.PI * 2
const presets = [0, 30, 45, 60, 90, 180, 270, 360]
const WAVE_WIDTH = 760
const WAVE_HEIGHT = 300
const WAVE_SPAN = TAU * 1.8
const CURRENT_WAVE_X_RATIO = 0.58
const TRAIL_LENGTH = 4.8
const TRAIL_CYCLE_LENGTH = 1.35

type ProjectionKind = 'orbit' | 'sin' | 'cos'

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

const projectionPoint = (kind: ProjectionKind, t: number, radians: number) => {
  const progress = t / TRAIL_LENGTH
  const baseX = 520 - progress * 450

  if (kind === 'sin') {
    return { x: baseX, y: 112 - Math.sin(radians) * 70 }
  }

  if (kind === 'cos') {
    return { x: baseX, y: 112 - Math.cos(radians) * 70 }
  }

  return {
    x: baseX + Math.cos(radians) * 22,
    y: 112 - Math.sin(radians) * 62 + Math.cos(radians) * 10,
  }
}

const buildProjectionPath = (phase: number, kind: ProjectionKind) => {
  const steps = 220
  return Array.from({ length: steps + 1 }, (_, index) => {
    const t = (index / steps) * TRAIL_LENGTH
    const radians = phase - (t / TRAIL_CYCLE_LENGTH) * TAU
    const point = projectionPoint(kind, t, radians)
    return `${index === 0 ? 'M' : 'L'} ${point.x.toFixed(2)} ${point.y.toFixed(2)}`
  }).join(' ')
}

export default function App() {
  const [phase, setPhase] = useState(degreesToRadians(45))
  const [playing, setPlaying] = useState(false)
  const [speed, setSpeed] = useState(0.7)
  const [draggingCircle, setDraggingCircle] = useState(false)
  const circleRef = useRef<SVGSVGElement>(null)
  const waveDragRef = useRef<{ clientX: number; phase: number } | null>(null)

  const normalizedAngle = normalizeRadians(phase)
  const values = useMemo(() => trigValuesFromRadians(phase), [phase])
  const displayDegrees = radiansToDegrees(normalizedAngle)

  const cx = 210
  const cy = 210
  const radius = 132
  const pointX = cx + values.cos * radius
  const pointY = cy - values.sin * radius

  const waveStart = phase - WAVE_SPAN * CURRENT_WAVE_X_RATIO
  const waveEnd = waveStart + WAVE_SPAN
  const sinePath = useMemo(() => buildWavePath(Math.sin, waveStart, WAVE_SPAN), [waveStart])
  const cosinePath = useMemo(() => buildWavePath(Math.cos, waveStart, WAVE_SPAN), [waveStart])
  const waveCursorX = WAVE_WIDTH * CURRENT_WAVE_X_RATIO
  const sineY = 142 - values.sin * 94
  const cosineY = 142 - values.cos * 94

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

  const orbitPath = useMemo(() => buildProjectionPath(phase, 'orbit'), [phase])
  const sineProjectionPath = useMemo(() => buildProjectionPath(phase, 'sin'), [phase])
  const cosineProjectionPath = useMemo(() => buildProjectionPath(phase, 'cos'), [phase])
  const orbitCurrent = projectionPoint('orbit', 0, phase)
  const sinCurrent = projectionPoint('sin', 0, phase)
  const cosCurrent = projectionPoint('cos', 0, phase)

  useEffect(() => {
    if (!playing) return

    let frame = 0
    let last = performance.now()

    const tick = (now: number) => {
      const deltaSeconds = Math.min((now - last) / 1000, 0.05)
      last = now
      setPhase((current) => current + deltaSeconds * speed)
      frame = requestAnimationFrame(tick)
    }

    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [playing, speed])

  const setAngleFromCirclePointer = (clientX: number, clientY: number) => {
    const svg = circleRef.current
    if (!svg) return

    const rect = svg.getBoundingClientRect()
    const x = ((clientX - rect.left) / rect.width) * 420
    const y = ((clientY - rect.top) / rect.height) * 420
    const nextNormalized = normalizeRadians(Math.atan2(cy - y, x - cx))
    setPhase((current) => nearestEquivalentAngle(nextNormalized, current))
  }

  const setPreset = (degrees: number) => {
    setPlaying(false)
    if (degrees === 360) {
      setPhase((current) => (Math.floor(current / TAU) + 1) * TAU)
      return
    }
    setPhase((current) => nearestEquivalentAngle(degreesToRadians(degrees), current))
  }

  const angleArcRadius = 43
  const arcEndX = cx + Math.cos(normalizedAngle) * angleArcRadius
  const arcEndY = cy - Math.sin(normalizedAngle) * angleArcRadius
  const largeArc = normalizedAngle > Math.PI ? 1 : 0
  const angleArc = normalizedAngle < 0.001
    ? ''
    : `M ${cx + angleArcRadius} ${cy} A ${angleArcRadius} ${angleArcRadius} 0 ${largeArc} 0 ${arcEndX} ${arcEndY}`

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

        <div className="preset-row" aria-label="代表角">
          {presets.map((degrees) => (
            <button
              key={degrees}
              className={degrees !== 360 && Math.abs(displayDegrees - degrees) < 0.25 ? 'active' : ''}
              type="button"
              onClick={() => setPreset(degrees)}
            >
              {degrees}°
            </button>
          ))}
        </div>

        <label className="speed-control">
          <span>×{speed.toFixed(1)}</span>
          <input
            aria-label="再生速度"
            type="range"
            min="0.2"
            max="2"
            step="0.1"
            value={speed}
            onChange={(event) => setSpeed(Number(event.target.value))}
          />
        </label>
      </section>

      <section className="visual-grid">
        <article className="panel visual-card circle-card">
          <div className="panel-heading"><h2>円</h2></div>
          <svg
            ref={circleRef}
            className="circle-svg"
            viewBox="0 0 420 420"
            role="img"
            aria-label={`角度 ${displayDegrees.toFixed(0)} 度の単位円`}
            onPointerDown={(event) => {
              setPlaying(false)
              setDraggingCircle(true)
              event.currentTarget.setPointerCapture(event.pointerId)
              setAngleFromCirclePointer(event.clientX, event.clientY)
            }}
            onPointerMove={(event) => {
              if (draggingCircle) setAngleFromCirclePointer(event.clientX, event.clientY)
            }}
            onPointerUp={(event) => {
              setDraggingCircle(false)
              event.currentTarget.releasePointerCapture(event.pointerId)
            }}
            onPointerCancel={() => setDraggingCircle(false)}
          >
            <g className="grid-lines">
              <line x1="34" y1={cy} x2="386" y2={cy} />
              <line x1={cx} y1="34" x2={cx} y2="386" />
            </g>
            <circle cx={cx} cy={cy} r={radius} className="unit-circle" />
            {angleArc && <path d={angleArc} className="angle-arc" />}
            <line x1={cx} y1={cy} x2={pointX} y2={pointY} className="radius-line" />
            <line x1={cx} y1={pointY} x2={pointX} y2={pointY} className="projection projection-cos" />
            <line x1={pointX} y1={cy} x2={pointX} y2={pointY} className="projection projection-sin" />
            <circle cx={pointX} cy={pointY} r="20" className="point-hit" />
            <circle cx={pointX} cy={pointY} r="8" className="point" />
            <text x={pointX} y={cy + 30} className="projection-label cos-label">cos</text>
            <text x={pointX + 18} y={(cy + pointY) / 2} className="projection-label sin-label">sin</text>
          </svg>
        </article>

        <article className="panel visual-card wave-card">
          <div className="panel-heading"><h2>波</h2></div>
          <svg
            className="wave-svg"
            viewBox={`0 0 ${WAVE_WIDTH} ${WAVE_HEIGHT}`}
            role="img"
            aria-label="連続するサインとコサインの波形"
            onPointerDown={(event) => {
              setPlaying(false)
              waveDragRef.current = { clientX: event.clientX, phase }
              event.currentTarget.setPointerCapture(event.pointerId)
            }}
            onPointerMove={(event) => {
              const drag = waveDragRef.current
              if (!drag) return
              const rect = event.currentTarget.getBoundingClientRect()
              const deltaX = event.clientX - drag.clientX
              setPhase(drag.phase - (deltaX / rect.width) * WAVE_SPAN)
            }}
            onPointerUp={(event) => {
              waveDragRef.current = null
              event.currentTarget.releasePointerCapture(event.pointerId)
            }}
            onPointerCancel={() => {
              waveDragRef.current = null
            }}
          >
            <line x1="0" y1="142" x2={WAVE_WIDTH} y2="142" className="wave-axis" />
            {waveTicks.map((tick) => (
              <g key={tick.radians}>
                <line x1={tick.x} y1="26" x2={tick.x} y2="250" className="wave-grid-line" />
                <text x={tick.x} y="278" className="wave-tick">{formatHalfPiTick(tick.radians)}</text>
              </g>
            ))}
            <path d={cosinePath} className="wave-line cosine-wave" />
            <path d={sinePath} className="wave-line sine-wave" />
            <line x1={waveCursorX} y1="22" x2={waveCursorX} y2="252" className="cursor-line" />
            <circle cx={waveCursorX} cy={cosineY} r="6" className="wave-dot cosine-dot" />
            <circle cx={waveCursorX} cy={sineY} r="6" className="wave-dot sine-dot" />
          </svg>
        </article>
      </section>

      <section className="panel projection-section">
        <div className="panel-heading"><h2>投影</h2></div>
        <div className="projection-grid">
          <article className="projection-card orbit-card">
            <div className="projection-key"><i />円運動</div>
            <svg viewBox="0 0 560 224" role="img" aria-label="円運動の軌跡">
              <line x1="50" y1="112" x2="532" y2="112" className="projection-axis" />
              <path d={orbitPath} className="trail trail-orbit" />
              <line x1="520" y1="30" x2="520" y2="194" className="now-line" />
              <circle cx={orbitCurrent.x} cy={orbitCurrent.y} r="6" className="orbit-dot" />
            </svg>
          </article>

          <article className="projection-card sin-card">
            <div className="projection-key"><i />sin</div>
            <svg viewBox="0 0 560 224" role="img" aria-label="サインの投影">
              <line x1="50" y1="112" x2="532" y2="112" className="projection-axis" />
              <path d={sineProjectionPath} className="trail trail-sin" />
              <line x1="520" y1="30" x2="520" y2="194" className="now-line" />
              <circle cx={sinCurrent.x} cy={sinCurrent.y} r="6" className="sin-dot" />
            </svg>
          </article>

          <article className="projection-card cos-card">
            <div className="projection-key"><i />cos</div>
            <svg viewBox="0 0 560 224" role="img" aria-label="コサインの投影">
              <line x1="50" y1="112" x2="532" y2="112" className="projection-axis" />
              <path d={cosineProjectionPath} className="trail trail-cos" />
              <line x1="520" y1="30" x2="520" y2="194" className="now-line" />
              <circle cx={cosCurrent.x} cy={cosCurrent.y} r="6" className="cos-dot" />
            </svg>
          </article>
        </div>
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
