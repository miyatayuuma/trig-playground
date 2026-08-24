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
const WAVE_WIDTH = 900
const WAVE_HEIGHT = 280
const WAVE_SPAN = TAU * 2.3
const CURRENT_WAVE_X_RATIO = 0.57
const ISO_LENGTH = 5.4
const ISO_CYCLE_LENGTH = 1.45

const buildWavePath = (
  fn: (radians: number) => number,
  startRadians: number,
  spanRadians: number,
) => {
  const midY = 132
  const amplitude = 86
  const steps = 360

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

const projectIso = (t: number, x: number, y: number) => ({
  x: 460 - t * 62 + x * 55,
  y: 112 + t * 27 + x * 28 - y * 58,
})

const buildIsoPath = (
  phase: number,
  projector: (t: number, radians: number) => { x: number; y: number },
) => {
  const steps = 220
  return Array.from({ length: steps + 1 }, (_, index) => {
    const t = (index / steps) * ISO_LENGTH
    const radians = phase - (t / ISO_CYCLE_LENGTH) * TAU
    const point = projector(t, radians)
    return `${index === 0 ? 'M' : 'L'} ${point.x.toFixed(2)} ${point.y.toFixed(2)}`
  }).join(' ')
}

const isoGridT = [0, 1.35, 2.7, 4.05, 5.4]
const isoGridValue = [-1, -0.5, 0, 0.5, 1]

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
  const sineY = 132 - values.sin * 86
  const cosineY = 132 - values.cos * 86

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

  const helixPath = useMemo(
    () => buildIsoPath(phase, (t, radians) => projectIso(t, Math.cos(radians), Math.sin(radians))),
    [phase],
  )
  const sineProjectionPath = useMemo(
    () => buildIsoPath(phase, (t, radians) => projectIso(t, 0, Math.sin(radians))),
    [phase],
  )
  const cosineProjectionPath = useMemo(
    () => buildIsoPath(phase, (t, radians) => projectIso(t, Math.cos(radians), 0)),
    [phase],
  )

  const isoOrigin = projectIso(0, 0, 0)
  const isoTimeEnd = projectIso(ISO_LENGTH + 0.55, 0, 0)
  const isoXEnd = projectIso(0, 1.5, 0)
  const isoYEnd = projectIso(0, 0, 1.5)
  const currentIsoPoint = projectIso(0, values.cos, values.sin)
  const currentSinProjection = projectIso(0, 0, values.sin)
  const currentCosProjection = projectIso(0, values.cos, 0)

  const verticalPlane = [
    projectIso(0, 0, -1.2),
    projectIso(0, 0, 1.2),
    projectIso(ISO_LENGTH, 0, 1.2),
    projectIso(ISO_LENGTH, 0, -1.2),
  ]
  const floorPlane = [
    projectIso(0, -1.2, 0),
    projectIso(0, 1.2, 0),
    projectIso(ISO_LENGTH, 1.2, 0),
    projectIso(ISO_LENGTH, -1.2, 0),
  ]

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
      <header className="hero">
        <div>
          <p className="eyebrow">TRIG PLAYGROUND</p>
          <h1>円をほどくと、ふたつの波になる。</h1>
          <p className="lead">同じ円運動を横と縦から見ると cos と sin が現れます。</p>
        </div>
        <div className="hero-readout" aria-live="polite">
          <span>θ</span>
          <strong>{displayDegrees.toFixed(displayDegrees % 1 === 0 ? 0 : 1)}°</strong>
          <small>{formatRadians(normalizedAngle)}</small>
        </div>
      </header>

      <section className="panel control-panel" aria-label="角度コントロール">
        <div className="control-top">
          <div className="angle-block">
            <span>ANGLE</span>
            <strong>{displayDegrees.toFixed(displayDegrees % 1 === 0 ? 0 : 1)}°</strong>
            <small>{formatRadians(normalizedAngle)}</small>
          </div>
          <button
            className={`play-button ${playing ? 'is-playing' : ''}`}
            type="button"
            onClick={() => setPlaying((current) => !current)}
            aria-pressed={playing}
          >
            {playing ? '停止' : '▶ 再生'}
          </button>
        </div>

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

        <div className="control-bottom">
          <div className="value-cards">
            <div className="value-card sine-value"><span>sin θ</span><strong>{values.sin.toFixed(4)}</strong></div>
            <div className="value-card cosine-value"><span>cos θ</span><strong>{values.cos.toFixed(4)}</strong></div>
          </div>
          <label className="speed-control">
            <span>速度</span>
            <input type="range" min="0.2" max="2" step="0.1" value={speed} onChange={(event) => setSpeed(Number(event.target.value))} />
          </label>
        </div>
      </section>

      <section className="panel iso-card">
        <div className="panel-heading">
          <div><span className="step">01</span><h2>同じ波を3方向から見る</h2></div>
          <p>黒 = 円運動 / 赤 = sin / 青 = cos</p>
        </div>

        <div className="iso-stage">
          <svg className="iso-svg" viewBox="0 0 540 360" role="img" aria-label="円運動とサイン・コサインの3次元投影">
            <polygon points={verticalPlane.map((point) => `${point.x},${point.y}`).join(' ')} className="iso-plane iso-plane-sin" />
            <polygon points={floorPlane.map((point) => `${point.x},${point.y}`).join(' ')} className="iso-plane iso-plane-cos" />

            <g className="iso-grid">
              {isoGridT.map((t) => {
                const a = projectIso(t, 0, -1.2)
                const b = projectIso(t, 0, 1.2)
                const c = projectIso(t, -1.2, 0)
                const d = projectIso(t, 1.2, 0)
                return (
                  <g key={t}>
                    <line x1={a.x} y1={a.y} x2={b.x} y2={b.y} />
                    <line x1={c.x} y1={c.y} x2={d.x} y2={d.y} />
                  </g>
                )
              })}
              {isoGridValue.map((value) => {
                const sinA = projectIso(0, 0, value)
                const sinB = projectIso(ISO_LENGTH, 0, value)
                const cosA = projectIso(0, value, 0)
                const cosB = projectIso(ISO_LENGTH, value, 0)
                return (
                  <g key={value}>
                    <line x1={sinA.x} y1={sinA.y} x2={sinB.x} y2={sinB.y} />
                    <line x1={cosA.x} y1={cosA.y} x2={cosB.x} y2={cosB.y} />
                  </g>
                )
              })}
            </g>

            <g className="iso-axes">
              <line x1={isoOrigin.x} y1={isoOrigin.y} x2={isoTimeEnd.x} y2={isoTimeEnd.y} />
              <line x1={isoOrigin.x} y1={isoOrigin.y} x2={isoXEnd.x} y2={isoXEnd.y} />
              <line x1={isoOrigin.x} y1={isoOrigin.y} x2={isoYEnd.x} y2={isoYEnd.y} />
            </g>

            <path d={sineProjectionPath} className="iso-projection iso-sin" />
            <path d={cosineProjectionPath} className="iso-projection iso-cos" />
            <path d={helixPath} className="iso-helix" />

            <line x1={currentIsoPoint.x} y1={currentIsoPoint.y} x2={currentSinProjection.x} y2={currentSinProjection.y} className="iso-guide iso-guide-sin" />
            <line x1={currentIsoPoint.x} y1={currentIsoPoint.y} x2={currentCosProjection.x} y2={currentCosProjection.y} className="iso-guide iso-guide-cos" />
            <circle cx={currentIsoPoint.x} cy={currentIsoPoint.y} r="5.5" className="iso-current" />
            <circle cx={currentSinProjection.x} cy={currentSinProjection.y} r="4.5" className="iso-sin-dot" />
            <circle cx={currentCosProjection.x} cy={currentCosProjection.y} r="4.5" className="iso-cos-dot" />
          </svg>
        </div>

        <div className="iso-caption">
          <span><i className="caption-line black" />円運動</span>
          <span><i className="caption-line red" />sin θ</span>
          <span><i className="caption-line blue" />cos θ</span>
        </div>
      </section>

      <section className="visual-grid">
        <article className="panel circle-card">
          <div className="panel-heading">
            <div><span className="step">02</span><h2>単位円</h2></div>
            <p>円周をドラッグ</p>
          </div>

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
            <circle cx={pointX} cy={pointY} r="18" className="point-hit" />
            <circle cx={pointX} cy={pointY} r="8" className="point" />
            <text x={pointX} y={cy + 30} className="projection-label cos-label">cos θ</text>
            <text x={pointX + 18} y={(cy + pointY) / 2} className="projection-label sin-label">sin θ</text>
          </svg>
        </article>

        <article className="panel wave-card">
          <div className="panel-heading">
            <div><span className="step">03</span><h2>終わらない波</h2></div>
            <p>左右にスワイプ</p>
          </div>

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
            <line x1="0" y1="132" x2={WAVE_WIDTH} y2="132" className="wave-axis" />
            {waveTicks.map((tick) => (
              <g key={tick.radians}>
                <line x1={tick.x} y1="24" x2={tick.x} y2="236" className="wave-grid-line" />
                <text x={tick.x} y="262" className="wave-tick">{formatHalfPiTick(tick.radians)}</text>
              </g>
            ))}
            <path d={cosinePath} className="wave-line cosine-wave" />
            <path d={sinePath} className="wave-line sine-wave" />
            <line x1={waveCursorX} y1="18" x2={waveCursorX} y2="238" className="cursor-line" />
            <circle cx={waveCursorX} cy={cosineY} r="6" className="wave-dot cosine-dot" />
            <circle cx={waveCursorX} cy={sineY} r="6" className="wave-dot sine-dot" />
          </svg>

          <div className="wave-caption">再生すると波形が途切れず流れ続けます。</div>
        </article>
      </section>
    </main>
  )
}
