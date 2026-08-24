import { useMemo, useState } from 'react'
import { trigValues } from './math'

const presets = [0, 30, 45, 60, 90, 180, 270, 360]

export default function App() {
  const [angle, setAngle] = useState(45)
  const { radians, sin, cos } = useMemo(() => trigValues(angle), [angle])

  const cx = 160
  const cy = 160
  const r = 110
  const px = cx + cos * r
  const py = cy - sin * r

  return (
    <main className="app">
      <section className="panel intro">
        <p className="eyebrow">TRIG PLAYGROUND</p>
        <h1>角度を動かして、三角関数を見る。</h1>
        <p>単位円・座標・数値を1つの角度で同期させる最初のプロトタイプです。</p>
      </section>

      <section className="workspace">
        <div className="panel circle-panel">
          <svg viewBox="0 0 320 320" role="img" aria-label="単位円">
            <line x1="30" y1={cy} x2="290" y2={cy} className="axis" />
            <line x1={cx} y1="30" x2={cx} y2="290" className="axis" />
            <circle cx={cx} cy={cy} r={r} className="unit-circle" />
            <line x1={cx} y1={cy} x2={px} y2={py} className="radius" />
            <line x1={px} y1={py} x2={px} y2={cy} className="projection cos" />
            <line x1={px} y1={py} x2={cx} y2={py} className="projection sin" />
            <circle cx={px} cy={py} r="7" className="point" />
          </svg>
        </div>

        <div className="panel controls">
          <label htmlFor="angle">角度 θ</label>
          <div className="angle-value">{angle}°</div>
          <input
            id="angle"
            type="range"
            min="0"
            max="360"
            step="1"
            value={angle}
            onChange={(e) => setAngle(Number(e.target.value))}
          />

          <div className="presets" aria-label="代表角">
            {presets.map((value) => (
              <button key={value} type="button" onClick={() => setAngle(value)}>
                {value}°
              </button>
            ))}
          </div>

          <dl className="values">
            <div><dt>radian</dt><dd>{radians.toFixed(3)}</dd></div>
            <div><dt>sin θ</dt><dd>{sin.toFixed(3)}</dd></div>
            <div><dt>cos θ</dt><dd>{cos.toFixed(3)}</dd></div>
            <div><dt>(x, y)</dt><dd>({cos.toFixed(3)}, {sin.toFixed(3)})</dd></div>
          </dl>
        </div>
      </section>
    </main>
  )
}
