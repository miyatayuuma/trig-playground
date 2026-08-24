import { useEffect, useMemo, useRef, useState } from 'react'
import {
  degreesToRadians,
  formatRadians,
  normalizeRadians,
  radiansToDegrees,
  trigValuesFromRadians,
} from './math'

const TAU = Math.PI * 2
const presets = [0, 30, 45, 60, 90, 180, 270, 360]

const buildWavePath = (fn: (radians: number) => number) => {
  const left = 54
  const width = 636
  const midY = 170
  const amplitude = 112
  const steps = 220

  return Array.from({ length: steps + 1 }, (_, index) => {
    const radians = (index / steps) * TAU
    const x = left + (index / steps) * width
    const y = midY - fn(radians) * amplitude
    return `${index === 0 ? 'M' : 'L'} ${x.toFixed(2)} ${y.toFixed(2)}`
  }).join(' ')
}

export default function App() {
  const [angle, setAngle] = useState(degreesToRadians(45))
  const [playing, setPlaying] = useState(false)
  const [speed, setSpeed] = useState(0.65)
  const [dragging, setDragging] = useState(false)
  const svgRef = useRef<SVGSVGElement>(null)

  const values = useMemo(() => trigValuesFromRadians(angle), [angle])
  const displayDegrees = Math.abs(angle - TAU) < 1e-8 ? 360 : radiansToDegrees(normalizeRadians(angle))
  const graphAngle = normalizeRadians(angle)

  const cx = 210
  const cy = 210
  const radius = 132
  const pointX = cx + values.cos * radius
  const pointY = cy - values.sin * radius

  const sinePath = useMemo(() => buildWavePath(Math.sin), [])
  const cosinePath = useMemo(() => buildWavePath(Math.cos), [])
  const graphX = 54 + (graphAngle / TAU) * 636
  const sineY = 170 - Math.sin(graphAngle) * 112
  const cosineY = 170 - Math.cos(graphAngle) * 112

  useEffect(() => {
    if (!playing) return

    let frame = 0
    let last = performance.now()

    const tick = (now: number) => {
      const deltaSeconds = Math.min((now - last) / 1000, 0.05)
      last = now
      setAngle((current) => normalizeRadians(current + deltaSeconds * speed))
      frame = requestAnimationFrame(tick)
    }

    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [playing, speed])

  const setAngleFromPointer = (clientX: number, clientY: number) => {
    const svg = svgRef.current
    if (!svg) return

    const rect = svg.getBoundingClientRect()
    const x = ((clientX - rect.left) / rect.width) * 420
    const y = ((clientY - rect.top) / rect.height) * 420
    const next = normalizeRadians(Math.atan2(cy - y, x - cx))
    setAngle(next)
  }

  const angleArcRadius = 43
  const arcEndX = cx + Math.cos(graphAngle) * angleArcRadius
  const arcEndY = cy - Math.sin(graphAngle) * angleArcRadius
  const largeArc = graphAngle > Math.PI ? 1 : 0
  const angleArc = graphAngle < 0.001
    ? ''
    : `M ${cx + angleArcRadius} ${cy} A ${angleArcRadius} ${angleArcRadius} 0 ${largeArc} 0 ${arcEndX} ${arcEndY}`

  return (
    <main className="app">
      <header className="hero">
        <div>
          <p className="eyebrow">TRIG PLAYGROUND</p>
          <h1>円を回すと、波が生まれる。</h1>
          <p className="lead">点を動かして、sin と cos を「公式」ではなく動きとしてつかむ。</p>
        </div>
        <div className="hero-readout" aria-live="polite">
          <span>θ</span>
          <strong>{displayDegrees.toFixed(displayDegrees % 1 === 0 ? 0 : 1)}°</strong>
          <small>{formatRadians(angle)}</small>
        </div>
      </header>

      <section className="visual-grid">
        <article className="panel circle-card">
          <div className="panel-heading">
            <div><span className="step">01</span><h2>単位円</h2></div>
            <p>円周をドラッグ</p>
          </div>

          <svg
            ref={svgRef}
            className="circle-svg"
            viewBox="0 0 420 420"
            role="img"
            aria-label={`角度 ${displayDegrees.toFixed(0)} 度の単位円`}
            onPointerDown={(event) => {
              setPlaying(false)
              setDragging(true)
              event.currentTarget.setPointerCapture(event.pointerId)
              setAngleFromPointer(event.clientX, event.clientY)
            }}
            onPointerMove={(event) => {
              if (dragging) setAngleFromPointer(event.clientX, event.clientY)
            }}
            onPointerUp={(event) => {
              setDragging(false)
              event.currentTarget.releasePointerCapture(event.pointerId)
            }}
            onPointerCancel={() => setDragging(false)}
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

            <line x1={cx} y1={cy + 8} x2={pointX} y2={cy + 8} className="measure measure-cos" />
            <line x1={pointX + 8} y1={cy} x2={pointX + 8} y2={pointY} className="measure measure-sin" />

            <circle cx={pointX} cy={pointY} r="18" className="point-hit" />
            <circle cx={pointX} cy={pointY} r="8" className="point" />

            <text x={pointX} y={cy + 32} className="projection-label cos-label">cos θ</text>
            <text x={pointX + 18} y={(cy + pointY) / 2} className="projection-label sin-label">sin θ</text>
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
            <div><span className="step">02</span><h2>円運動をほどく</h2></div>
            <p>横軸 = 角度 θ</p>
          </div>

          <svg className="wave-svg" viewBox="0 0 720 340" role="img" aria-label="サインとコサインの波形">
            <g className="wave-grid">
              <line x1="54" y1="58" x2="690" y2="58" />
              <line x1="54" y1="170" x2="690" y2="170" className="main-axis" />
              <line x1="54" y1="282" x2="690" y2="282" />
              {[54, 213, 372, 531, 690].map((x) => <line key={x} x1={x} y1="32" x2={x} y2="300" />)}
            </g>

            <path d={cosinePath} className="wave-line cosine-wave" />
            <path d={sinePath} className="wave-line sine-wave" />
            <line x1={graphX} y1="32" x2={graphX} y2="300" className="cursor-line" />
            <circle cx={graphX} cy={cosineY} r="6" className="wave-dot cosine-dot" />
            <circle cx={graphX} cy={sineY} r="6" className="wave-dot sine-dot" />

            <text x="35" y="62" className="axis-label">1</text>
            <text x="35" y="174" className="axis-label">0</text>
            <text x="35" y="286" className="axis-label">−1</text>
            <text x="54" y="324" className="axis-label">0</text>
            <text x="213" y="324" className="axis-label">π/2</text>
            <text x="372" y="324" className="axis-label">π</text>
            <text x="531" y="324" className="axis-label">3π/2</text>
            <text x="690" y="324" className="axis-label">2π</text>
          </svg>

          <div className="legend">
            <span><i className="legend-dot sin-dot" />sin θ = 縦の高さ</span>
            <span><i className="legend-dot cos-dot" />cos θ = 横の位置</span>
          </div>
        </article>
      </section>

      <section className="panel control-panel">
        <div className="control-top">
          <div className="angle-block">
            <span>ANGLE</span>
            <strong>{displayDegrees.toFixed(displayDegrees % 1 === 0 ? 0 : 1)}°</strong>
            <small>{formatRadians(angle)}</small>
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
            setAngle(degreesToRadians(Number(event.target.value)))
          }}
        />

        <div className="preset-row" aria-label="代表角">
          {presets.map((degrees) => (
            <button
              key={degrees}
              className={Math.abs(displayDegrees - degrees) < 0.25 ? 'active' : ''}
              type="button"
              onClick={() => {
                setPlaying(false)
                setAngle(degreesToRadians(degrees))
              }}
            >
              {degrees}°
            </button>
          ))}
        </div>

        <div className="bottom-row">
          <div className="value-cards">
            <div className="value-card sine-value"><span>sin θ</span><strong>{values.sin.toFixed(4)}</strong><small>y 座標</small></div>
            <div className="value-card cosine-value"><span>cos θ</span><strong>{values.cos.toFixed(4)}</strong><small>x 座標</small></div>
          </div>
          <label className="speed-control">
            <span>再生速度</span>
            <input type="range" min="0.2" max="2" step="0.1" value={speed} onChange={(event) => setSpeed(Number(event.target.value))} />
          </label>
        </div>
      </section>
    </main>
  )
}
