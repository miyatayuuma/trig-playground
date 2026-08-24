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
const WAVE_HEIGHT = 300
const WAVE_SPAN = TAU * 2.35
const CURRENT_WAVE_X_RATIO = 0.58

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value))

const buildWavePath = (
  fn: (radians: number) => number,
  startRadians: number,
  spanRadians: number,
) => {
  const midY = 142
  const amplitude = 92
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

const project3D = (x: number, y: number, z = 0) => ({
  x: 230 + x * 102 + z * 46,
  y: 205 - y * 82 + z * 25,
})

const buildProjectedCircle = () => {
  const steps = 96
  return Array.from({ length: steps + 1 }, (_, index) => {
    const radians = (index / steps) * TAU
    const point = project3D(Math.cos(radians), Math.sin(radians))
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
  const tangentDefined = Math.abs(values.cos) > 0.035
  const tangentDisplay = tangentDefined ? values.tan.toFixed(4) : '発散'

  const cx = 210
  const cy = 210
  const radius = 132
  const pointX = cx + values.cos * radius
  const pointY = cy - values.sin * radius
  const tangentVisual = clamp(values.tan, -1.45, 1.45)
  const tangentX = cx + radius
  const tangentY = cy - tangentVisual * radius

  const waveStart = phase - WAVE_SPAN * CURRENT_WAVE_X_RATIO
  const waveEnd = waveStart + WAVE_SPAN
  const sinePath = useMemo(() => buildWavePath(Math.sin, waveStart, WAVE_SPAN), [waveStart])
  const cosinePath = useMemo(() => buildWavePath(Math.cos, waveStart, WAVE_SPAN), [waveStart])
  const waveCursorX = WAVE_WIDTH * CURRENT_WAVE_X_RATIO
  const sineY = 142 - values.sin * 92
  const cosineY = 142 - values.cos * 92

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

  const projectedCirclePath = useMemo(() => buildProjectedCircle(), [])
  const projectedOrigin = project3D(0, 0)
  const projectedXAxisStart = project3D(-1.45, 0)
  const projectedXAxisEnd = project3D(1.55, 0)
  const projectedYAxisStart = project3D(0, -1.8)
  const projectedYAxisEnd = project3D(0, 1.8)
  const projectedTangentBase = project3D(1, 0)
  const projectedTangentTop = project3D(1, clamp(values.tan, -2.15, 2.15))
  const projectedRayEnd = project3D(1, clamp(values.tan, -2.15, 2.15))
  const wallA = project3D(1, -2.25, -0.55)
  const wallB = project3D(1, 2.25, -0.55)
  const wallC = project3D(1, 2.25, 0.55)
  const wallD = project3D(1, -2.25, 0.55)

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
      setPhase((current) => {
        const nextTurn = Math.floor(current / TAU) + 1
        return nextTurn * TAU
      })
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
          <h1>円・波・接線を、ひとつの動きで。</h1>
          <p className="lead">指で動かすと sin / cos / tan が同時に変化します。</p>
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

        <label className="slider-label" htmlFor="angle-slider">角度を動かす</label>
        <input
          id="angle-slider"
          className="angle-slider"
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

        <div className="bottom-row">
          <div className="value-cards">
            <div className="value-card sine-value"><span>sin θ</span><strong>{values.sin.toFixed(4)}</strong><small>y 座標</small></div>
            <div className="value-card cosine-value"><span>cos θ</span><strong>{values.cos.toFixed(4)}</strong><small>x 座標</small></div>
            <div className="value-card tangent-value"><span>tan θ</span><strong>{tangentDisplay}</strong><small>接線上の高さ</small></div>
          </div>
          <label className="speed-control">
            <span>再生速度</span>
            <input type="range" min="0.2" max="2" step="0.1" value={speed} onChange={(event) => setSpeed(Number(event.target.value))} />
          </label>
        </div>
      </section>

      <section className="visual-grid">
        <article className="panel circle-card">
          <div className="panel-heading">
            <div><span className="step">01</span><h2>単位円</h2></div>
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
              <line x1={cx - radius} y1="68" x2={cx - radius} y2="352" />
              <line x1={cx + radius} y1="68" x2={cx + radius} y2="352" />
              <line x1="68" y1={cy - radius} x2="352" y2={cy - radius} />
              <line x1="68" y1={cy + radius} x2="352" y2={cy + radius} />
            </g>

            <circle cx={cx} cy={cy} r={radius} className="unit-circle" />
            {angleArc && <path d={angleArc} className="angle-arc" />}
            <text x={cx + 56} y={cy - 18} className="theta-label">θ</text>

            <line x1={cx} y1={cy} x2={pointX} y2={pointY} className="radius-line" />
            <line x1={cx} y1={pointY} x2={pointX} y2={pointY} className="projection projection-cos" />
            <line x1={pointX} y1={cy} x2={pointX} y2={pointY} className="projection projection-sin" />
            <line x1={tangentX} y1="28" x2={tangentX} y2="392" className="tangent-axis" />
            <line x1={cx} y1={cy} x2={tangentX} y2={tangentY} className="tangent-ray" />
            <line x1={tangentX} y1={cy} x2={tangentX} y2={tangentY} className="tangent-measure" />

            <line x1={cx} y1={cy + 8} x2={pointX} y2={cy + 8} className="measure measure-cos" />
            <line x1={pointX + 8} y1={cy} x2={pointX + 8} y2={pointY} className="measure measure-sin" />

            <circle cx={pointX} cy={pointY} r="18" className="point-hit" />
            <circle cx={pointX} cy={pointY} r="8" className="point" />
            <circle cx={tangentX} cy={tangentY} r="5" className="tangent-dot" />

            <text x={pointX} y={cy + 32} className="projection-label cos-label">cos θ</text>
            <text x={pointX + 18} y={(cy + pointY) / 2} className="projection-label sin-label">sin θ</text>
            <text x={tangentX + 13} y={tangentY - 8} className="projection-label tan-label">tan θ</text>
            <text x={cx + radius + 9} y={cy + 22} className="axis-label">1</text>
            <text x={cx - radius - 18} y={cy + 22} className="axis-label">−1</text>
            <text x={cx + 13} y={cy - radius - 10} className="axis-label">1</text>
          </svg>

          <div className="coordinate-strip">
            <span>点 P</span>
            <strong>({values.cos.toFixed(3)}, {values.sin.toFixed(3)})</strong>
          </div>
        </article>

        <article className="panel wave-card">
          <div className="panel-heading">
            <div><span className="step">02</span><h2>終わらない波</h2></div>
            <p>再生で左へ流れる / 横スワイプ</p>
          </div>

          <div className="wave-window">
            <svg
              className="wave-svg"
              viewBox={`0 0 ${WAVE_WIDTH} ${WAVE_HEIGHT}`}
              role="img"
              aria-label="連続してスクロールするサインとコサインの波形"
              onPointerDown={(event) => {
                setPlaying(false)
                waveDragRef.current = { clientX: event.clientX, phase }
                event.currentTarget.setPointerCapture(event.pointerId)
              }}
              onPointerMove={(event) => {
                const drag = waveDragRef.current
                if (!drag) return
                const rect = event.currentTarget.getBoundingClientRect()
                const deltaRadians = ((event.clientX - drag.clientX) / rect.width) * WAVE_SPAN
                setPhase(drag.phase - deltaRadians)
              }}
              onPointerUp={(event) => {
                waveDragRef.current = null
                event.currentTarget.releasePointerCapture(event.pointerId)
              }}
              onPointerCancel={() => { waveDragRef.current = null }}
            >
              <g className="wave-grid">
                <line x1="0" y1="50" x2={WAVE_WIDTH} y2="50" />
                <line x1="0" y1="142" x2={WAVE_WIDTH} y2="142" className="main-axis" />
                <line x1="0" y1="234" x2={WAVE_WIDTH} y2="234" />
                {waveTicks.map((tick) => (
                  <line key={tick.radians} x1={tick.x} y1="28" x2={tick.x} y2="252" />
                ))}
              </g>

              <path d={cosinePath} className="wave-line cosine-wave" />
              <path d={sinePath} className="wave-line sine-wave" />
              <line x1={waveCursorX} y1="22" x2={waveCursorX} y2="252" className="cursor-line" />
              <circle cx={waveCursorX} cy={cosineY} r="6" className="wave-dot cosine-dot" />
              <circle cx={waveCursorX} cy={sineY} r="6" className="wave-dot sine-dot" />

              {waveTicks.map((tick) => (
                <text key={`label-${tick.radians}`} x={tick.x} y="278" className="wave-tick-label">
                  {formatHalfPiTick(tick.radians)}
                </text>
              ))}
              <text x={waveCursorX + 10} y="20" className="now-label">NOW</text>
            </svg>
          </div>

          <div className="legend">
            <span><i className="legend-dot sin-dot" />sin θ</span>
            <span><i className="legend-dot cos-dot" />cos θ</span>
            <span className="scroll-hint">波に端はありません</span>
          </div>
        </article>
      </section>

      <article className="panel tangent-card">
        <div className="panel-heading">
          <div><span className="step">03</span><h2>tan を立体で見る</h2></div>
          <p>x = 1 の壁まで伸ばした高さ</p>
        </div>

        <div className="tangent-layout">
          <svg className="tangent-3d" viewBox="0 0 480 360" role="img" aria-label="タンジェントを接線の高さとして示す立体図">
            <defs>
              <linearGradient id="wall-gradient" x1="0" x2="1">
                <stop offset="0%" stopColor="#ffca5c" stopOpacity="0.04" />
                <stop offset="100%" stopColor="#ffca5c" stopOpacity="0.18" />
              </linearGradient>
            </defs>
            <polygon
              points={`${wallA.x},${wallA.y} ${wallB.x},${wallB.y} ${wallC.x},${wallC.y} ${wallD.x},${wallD.y}`}
              className="tangent-wall"
            />
            <line x1={projectedXAxisStart.x} y1={projectedXAxisStart.y} x2={projectedXAxisEnd.x} y2={projectedXAxisEnd.y} className="axis-3d" />
            <line x1={projectedYAxisStart.x} y1={projectedYAxisStart.y} x2={projectedYAxisEnd.x} y2={projectedYAxisEnd.y} className="axis-3d" />
            <path d={projectedCirclePath} className="circle-3d" />
            <line x1={projectedOrigin.x} y1={projectedOrigin.y} x2={projectedRayEnd.x} y2={projectedRayEnd.y} className="ray-3d" />
            <line x1={projectedTangentBase.x} y1={projectedTangentBase.y} x2={projectedTangentTop.x} y2={projectedTangentTop.y} className="tan-height-3d" />
            <circle cx={projectedOrigin.x} cy={projectedOrigin.y} r="4" className="origin-3d" />
            <circle cx={projectedTangentTop.x} cy={projectedTangentTop.y} r="6" className="tangent-dot" />
            <text x={projectedTangentBase.x + 12} y={projectedTangentBase.y + 22} className="label-3d">x = 1</text>
            <text x={projectedTangentTop.x + 13} y={projectedTangentTop.y - 8} className="tan-label label-3d">tan θ</text>
          </svg>

          <div className="tangent-explainer">
            <div className="tan-number">
              <span>tan θ</span>
              <strong>{tangentDisplay}</strong>
            </div>
            <p>原点から角度 θ の直線を伸ばし、<strong>x = 1</strong> の接線とぶつかる高さが tan θ。</p>
            <div className="ratio-equation">
              <span>tan θ</span>
              <span>=</span>
              <span>sin θ / cos θ</span>
            </div>
            {!tangentDefined && <p className="asymptote-note">cos θ が 0 に近づくと交点が遠ざかり、tan θ は発散します。</p>}
          </div>
        </div>
      </article>
    </main>
  )
}
