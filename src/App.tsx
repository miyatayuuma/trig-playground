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
const VIEW_WIDTH = 760
const VIEW_HEIGHT = 430
const BOX_LENGTH = 5.4
const BOX_CYCLE_LENGTH = 1.48
const FACE_EXTENT = 1.15
const PLAYBACK_SPEED = 0.7
const CAMERA_TRANSITION_MS = 800

type ViewMode = 'box' | 'circle' | 'sin' | 'cos'
type FlatView = Exclude<ViewMode, 'box'>
type Vec3 = { x: number; y: number; z: number }
type Point = { x: number; y: number }
type CameraPose = {
  position: Vec3
  target: Vec3
  up: Vec3
  focal: number
}
type CameraState = {
  pose: CameraPose
  isolation: number
}
type TrailSegment = {
  start: Vec3
  end: Vec3
  opacity: number
}
type Gesture = {
  clientX: number
  clientY: number
  pointerId: number
}

const BOX_CAMERA: CameraPose = {
  position: { x: -1.8, y: 3.4, z: 0.65 },
  target: { x: BOX_LENGTH, y: 0, z: 0 },
  up: { x: 0, y: 0, z: 1 },
  focal: 920,
}

const VIEW_CAMERAS: Record<FlatView, CameraPose> = {
  circle: {
    position: { x: -0.65, y: 0, z: 0 },
    target: { x: BOX_LENGTH, y: 0, z: 0 },
    up: { x: 0, y: 0, z: 1 },
    focal: 980,
  },
  sin: {
    position: { x: BOX_LENGTH / 2, y: 5, z: 0.2 },
    target: { x: BOX_LENGTH / 2, y: -FACE_EXTENT, z: 0 },
    up: { x: 0, y: 0, z: 1 },
    focal: 780,
  },
  cos: {
    position: { x: BOX_LENGTH / 2, y: 0, z: 4.9 },
    target: { x: BOX_LENGTH / 2, y: 0, z: -FACE_EXTENT },
    up: { x: 0, y: -1, z: 0 },
    focal: 780,
  },
}

const subtract = (a: Vec3, b: Vec3): Vec3 => ({ x: a.x - b.x, y: a.y - b.y, z: a.z - b.z })
const scale = (vector: Vec3, amount: number): Vec3 => ({
  x: vector.x * amount,
  y: vector.y * amount,
  z: vector.z * amount,
})
const dot = (a: Vec3, b: Vec3) => a.x * b.x + a.y * b.y + a.z * b.z
const cross = (a: Vec3, b: Vec3): Vec3 => ({
  x: a.y * b.z - a.z * b.y,
  y: a.z * b.x - a.x * b.z,
  z: a.x * b.y - a.y * b.x,
})
const magnitude = (vector: Vec3) => Math.hypot(vector.x, vector.y, vector.z)
const normalize = (vector: Vec3): Vec3 => {
  const length = magnitude(vector)
  return length < 1e-8 ? { x: 0, y: 0, z: 0 } : scale(vector, 1 / length)
}
const lerp = (from: number, to: number, t: number) => from + (to - from) * t
const lerpVec = (from: Vec3, to: Vec3, t: number): Vec3 => ({
  x: lerp(from.x, to.x, t),
  y: lerp(from.y, to.y, t),
  z: lerp(from.z, to.z, t),
})
const lerpCamera = (from: CameraPose, to: CameraPose, t: number): CameraPose => ({
  position: lerpVec(from.position, to.position, t),
  target: lerpVec(from.target, to.target, t),
  up: normalize(lerpVec(from.up, to.up, t)),
  focal: lerp(from.focal, to.focal, t),
})
const smootherStep = (t: number) => t * t * t * (t * (t * 6 - 15) + 10)

const projectPoint = (point: Vec3, camera: CameraPose): Point => {
  const forward = normalize(subtract(camera.target, camera.position))
  const right = normalize(cross(forward, camera.up))
  const trueUp = normalize(cross(right, forward))
  const relative = subtract(point, camera.position)
  const depth = Math.max(0.35, dot(relative, forward))
  const perspective = camera.focal / depth

  return {
    x: VIEW_WIDTH / 2 + dot(relative, right) * perspective,
    y: VIEW_HEIGHT / 2 - dot(relative, trueUp) * perspective,
  }
}

const pointString = (point: Point) => `${point.x.toFixed(2)},${point.y.toFixed(2)}`
const pointsString = (points: Vec3[], camera: CameraPose) =>
  points.map((point) => pointString(projectPoint(point, camera))).join(' ')

const pathFromWorldPoints = (points: Vec3[], camera: CameraPose) =>
  points.map((point, index) => {
    const projected = projectPoint(point, camera)
    return `${index === 0 ? 'M' : 'L'} ${projected.x.toFixed(2)} ${projected.y.toFixed(2)}`
  }).join(' ')

const endFace = (x: number): Vec3[] => [
  { x, y: -FACE_EXTENT, z: -FACE_EXTENT },
  { x, y: FACE_EXTENT, z: -FACE_EXTENT },
  { x, y: FACE_EXTENT, z: FACE_EXTENT },
  { x, y: -FACE_EXTENT, z: FACE_EXTENT },
]

const wavePoint = (phase: number, kind: 'sin' | 'cos', distance: number): Vec3 => {
  const radians = phase + (distance / BOX_CYCLE_LENGTH) * TAU
  const x = BOX_LENGTH - distance

  if (kind === 'sin') {
    return { x, y: -FACE_EXTENT, z: Math.sin(radians) }
  }
  return { x, y: Math.cos(radians), z: -FACE_EXTENT }
}

const tailOpacity = (ratio: number) => {
  const fadeStart = 0.38
  if (ratio <= fadeStart) return 1
  const fadeProgress = Math.min(1, (ratio - fadeStart) / (1 - fadeStart))
  return 0.04 + 0.96 * (1 - smootherStep(fadeProgress))
}

const buildWaveSegments = (phase: number, kind: 'sin' | 'cos'): TrailSegment[] => {
  const segments = 180
  return Array.from({ length: segments }, (_, index) => {
    const d0 = (index / segments) * BOX_LENGTH
    const d1 = ((index + 1) / segments) * BOX_LENGTH
    return {
      start: wavePoint(phase, kind, d0),
      end: wavePoint(phase, kind, d1),
      opacity: tailOpacity(index / segments),
    }
  })
}

const buildHelix = (phase: number): TrailSegment[] => {
  const segments = 110
  const visibleDistance = BOX_LENGTH * 0.78

  return Array.from({ length: segments }, (_, index) => {
    const d0 = (index / segments) * BOX_LENGTH
    const d1 = ((index + 1) / segments) * BOX_LENGTH
    const r0 = phase + (d0 / BOX_CYCLE_LENGTH) * TAU
    const r1 = phase + (d1 / BOX_CYCLE_LENGTH) * TAU
    const fade = Math.max(0, 1 - d0 / visibleDistance)

    return {
      start: { x: BOX_LENGTH - d0, y: Math.cos(r0), z: Math.sin(r0) },
      end: { x: BOX_LENGTH - d1, y: Math.cos(r1), z: Math.sin(r1) },
      opacity: 0.24 * fade * fade,
    }
  })
}

const buildCircle = (): Vec3[] => {
  const steps = 120
  return Array.from({ length: steps + 1 }, (_, index) => {
    const radians = (index / steps) * TAU
    return { x: BOX_LENGTH, y: Math.cos(radians), z: Math.sin(radians) }
  })
}

const buildAngleArc = (radians: number): Vec3[] => {
  if (radians < 0.001) return []
  const steps = Math.max(4, Math.ceil((radians / TAU) * 72))
  return Array.from({ length: steps + 1 }, (_, index) => {
    const angle = (index / steps) * radians
    return {
      x: BOX_LENGTH,
      y: Math.cos(angle) * 0.36,
      z: Math.sin(angle) * 0.36,
    }
  })
}

export default function App() {
  const [phase, setPhase] = useState(degreesToRadians(45))
  const [playing, setPlaying] = useState(false)
  const [view, setView] = useState<ViewMode>('box')
  const [focusedMode, setFocusedMode] = useState<FlatView | null>(null)
  const [cameraState, setCameraState] = useState<CameraState>({ pose: BOX_CAMERA, isolation: 0 })
  const [transitioning, setTransitioning] = useState(false)
  const cameraAnimationRef = useRef<number | null>(null)
  const gestureRef = useRef<Gesture | null>(null)

  const normalizedAngle = normalizeRadians(phase)
  const values = useMemo(() => trigValuesFromRadians(phase), [phase])
  const displayDegrees = radiansToDegrees(normalizedAngle)

  const circleWorld = useMemo(() => buildCircle(), [])
  const angleArcWorld = buildAngleArc(normalizedAngle)
  const helix = buildHelix(phase)
  const sineSegments = buildWaveSegments(phase, 'sin')
  const cosineSegments = buildWaveSegments(phase, 'cos')

  const near = endFace(0)
  const far = endFace(BOX_LENGTH)
  const sinFace: Vec3[] = [near[0], near[3], far[3], far[0]]
  const cosFace: Vec3[] = [near[0], near[1], far[1], far[0]]

  const currentWorld: Vec3 = { x: BOX_LENGTH, y: values.cos, z: values.sin }
  const circleCenter: Vec3 = { x: BOX_LENGTH, y: 0, z: 0 }
  const sinCurrent: Vec3 = { x: BOX_LENGTH, y: -FACE_EXTENT, z: values.sin }
  const cosCurrent: Vec3 = { x: BOX_LENGTH, y: values.cos, z: -FACE_EXTENT }
  const thetaWorld: Vec3 = {
    x: BOX_LENGTH,
    y: Math.cos(normalizedAngle / 2) * 0.52,
    z: Math.sin(normalizedAngle / 2) * 0.52,
  }

  const xAxisStart: Vec3 = { x: BOX_LENGTH, y: -1.03, z: 0 }
  const xAxisEnd: Vec3 = { x: BOX_LENGTH, y: 1.03, z: 0 }
  const yAxisStart: Vec3 = { x: BOX_LENGTH, y: 0, z: -1.03 }
  const yAxisEnd: Vec3 = { x: BOX_LENGTH, y: 0, z: 1.03 }

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
    if (cameraAnimationRef.current !== null) cancelAnimationFrame(cameraAnimationRef.current)
  }, [])

  const animateCamera = (targetView: ViewMode) => {
    if (transitioning) return

    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const targetPose = targetView === 'box' ? BOX_CAMERA : VIEW_CAMERAS[targetView]
    const targetIsolation = targetView === 'box' ? 0 : 1
    const nextFocus: FlatView | null = targetView === 'box' ? null : targetView

    if (reducedMotion) {
      setCameraState({ pose: targetPose, isolation: targetIsolation })
      setFocusedMode(nextFocus)
      setView(targetView)
      return
    }

    if (targetView !== 'box') setFocusedMode(targetView)
    setTransitioning(true)

    const from = cameraState
    const startedAt = performance.now()
    const tick = (now: number) => {
      const raw = Math.min(1, (now - startedAt) / CAMERA_TRANSITION_MS)
      const eased = smootherStep(raw)
      setCameraState({
        pose: lerpCamera(from.pose, targetPose, eased),
        isolation: lerp(from.isolation, targetIsolation, eased),
      })

      if (raw < 1) {
        cameraAnimationRef.current = requestAnimationFrame(tick)
        return
      }

      cameraAnimationRef.current = null
      setView(targetView)
      setFocusedMode(nextFocus)
      setTransitioning(false)
    }

    cameraAnimationRef.current = requestAnimationFrame(tick)
  }

  const openFace = (mode: FlatView) => {
    if (view !== 'box' || transitioning) return
    animateCamera(mode)
  }

  const returnToBox = () => {
    if (view === 'box' || transitioning) return
    animateCamera('box')
  }

  const handleFocusedPointerDown = (event: ReactPointerEvent<SVGSVGElement>) => {
    if (view === 'box' || transitioning) return
    gestureRef.current = {
      clientX: event.clientX,
      clientY: event.clientY,
      pointerId: event.pointerId,
    }
    event.currentTarget.setPointerCapture(event.pointerId)
  }

  const handleFocusedPointerUp = (event: ReactPointerEvent<SVGSVGElement>) => {
    const gesture = gestureRef.current
    gestureRef.current = null
    if (!gesture || transitioning || view === 'box') return

    if (event.currentTarget.hasPointerCapture(gesture.pointerId)) {
      event.currentTarget.releasePointerCapture(gesture.pointerId)
    }

    const dx = event.clientX - gesture.clientX
    const dy = event.clientY - gesture.clientY
    if (Math.hypot(dx, dy) < 14 || Math.abs(dx) > 42 || Math.abs(dy) > 42) returnToBox()
  }

  const handleFocusedKeyDown = (event: ReactKeyboardEvent<SVGSVGElement>) => {
    if (view !== 'box' && (event.key === 'Enter' || event.key === ' ')) {
      event.preventDefault()
      returnToBox()
    }
  }

  const camera = cameraState.pose
  const isolation = cameraState.isolation
  const otherOpacity = 1 - isolation * 0.96
  const edgeOpacity = 1 - isolation * 0.94
  const targetSurfaceOpacity = 0.08 + isolation * 0.08
  const circleOpacity = focusedMode && focusedMode !== 'circle' ? otherOpacity : 1
  const sinOpacity = focusedMode && focusedMode !== 'sin' ? otherOpacity : 1
  const cosOpacity = focusedMode && focusedMode !== 'cos' ? otherOpacity : 1
  const helixOpacity = focusedMode ? otherOpacity : 1
  const guideOpacity = focusedMode === 'circle' ? 1 : otherOpacity

  const projectedCurrent = projectPoint(currentWorld, camera)
  const projectedTheta = projectPoint(thetaWorld, camera)
  const projectedCircleCenter = projectPoint(circleCenter, camera)
  const projectedSin = projectPoint(sinCurrent, camera)
  const projectedCos = projectPoint(cosCurrent, camera)

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
          <span className="model-mode">{focusedMode?.toUpperCase() ?? 'BOX'}</span>
        </div>

        <div className="model-stage">
          <svg
            className={`camera-svg ${view === 'box' ? 'is-box-view' : 'is-focus-view'}`}
            viewBox={`0 0 ${VIEW_WIDTH} ${VIEW_HEIGHT}`}
            role={view === 'box' ? 'img' : 'button'}
            tabIndex={view === 'box' ? undefined : 0}
            aria-label={view === 'box'
              ? '円運動とサイン・コサインの3D投影モデル'
              : `${focusedMode === 'circle' ? '単位円' : focusedMode === 'sin' ? 'サイン' : 'コサイン'}を正面から表示。タップまたはスワイプで箱表示に戻る`}
            onPointerDown={handleFocusedPointerDown}
            onPointerUp={handleFocusedPointerUp}
            onPointerCancel={() => { gestureRef.current = null }}
            onKeyDown={handleFocusedKeyDown}
          >
            <polygon
              points={pointsString(sinFace, camera)}
              className="box-face box-face-sin"
              style={{ opacity: focusedMode === 'sin' ? targetSurfaceOpacity : 0.025 * otherOpacity }}
            />
            <g className="box-wave-trail" style={{ opacity: 0.82 * sinOpacity }}>
              {sineSegments.map((segment, index) => {
                const start = projectPoint(segment.start, camera)
                const end = projectPoint(segment.end, camera)
                return (
                  <line
                    key={index}
                    x1={start.x}
                    y1={start.y}
                    x2={end.x}
                    y2={end.y}
                    className="box-wave box-wave-sin"
                    style={{ opacity: segment.opacity }}
                  />
                )
              })}
            </g>

            <polygon
              points={pointsString(near, camera)}
              className="box-face box-face-near"
              style={{ opacity: 0.018 * otherOpacity }}
            />
            <polygon
              points={pointsString(cosFace, camera)}
              className="box-face box-face-cos"
              style={{ opacity: focusedMode === 'cos' ? targetSurfaceOpacity : 0.045 * otherOpacity }}
            />
            <polygon
              points={pointsString(far, camera)}
              className="box-face box-face-circle"
              style={{ opacity: focusedMode === 'circle' ? targetSurfaceOpacity : 0.025 * circleOpacity }}
            />

            <g className="box-edges" style={{ opacity: edgeOpacity }}>
              <polyline points={`${pointsString(near, camera)} ${pointString(projectPoint(near[0], camera))}`} />
              <polyline points={`${pointsString(far, camera)} ${pointString(projectPoint(far[0], camera))}`} />
              {near.map((point, index) => {
                const start = projectPoint(point, camera)
                const end = projectPoint(far[index], camera)
                return <line key={index} x1={start.x} y1={start.y} x2={end.x} y2={end.y} />
              })}
            </g>

            <g className="box-wave-trail" style={{ opacity: 0.92 * cosOpacity }}>
              {cosineSegments.map((segment, index) => {
                const start = projectPoint(segment.start, camera)
                const end = projectPoint(segment.end, camera)
                return (
                  <line
                    key={index}
                    x1={start.x}
                    y1={start.y}
                    x2={end.x}
                    y2={end.y}
                    className="box-wave box-wave-cos"
                    style={{ opacity: segment.opacity }}
                  />
                )
              })}
            </g>

            <g className="box-helix-fade" style={{ opacity: helixOpacity }} aria-hidden="true">
              {helix.map((segment, index) => {
                const start = projectPoint(segment.start, camera)
                const end = projectPoint(segment.end, camera)
                return (
                  <line
                    key={index}
                    x1={start.x}
                    y1={start.y}
                    x2={end.x}
                    y2={end.y}
                    className="box-helix-segment"
                    style={{ opacity: segment.opacity }}
                  />
                )
              })}
            </g>

            <g className="circle-plane-details" style={{ opacity: circleOpacity }}>
              {(() => {
                const xStart = projectPoint(xAxisStart, camera)
                const xEnd = projectPoint(xAxisEnd, camera)
                const yStart = projectPoint(yAxisStart, camera)
                const yEnd = projectPoint(yAxisEnd, camera)
                return (
                  <g className="box-circle-axes">
                    <line x1={xStart.x} y1={xStart.y} x2={xEnd.x} y2={xEnd.y} />
                    <line x1={yStart.x} y1={yStart.y} x2={yEnd.x} y2={yEnd.y} />
                  </g>
                )
              })()}
              <path d={pathFromWorldPoints(circleWorld, camera)} className="box-circle" />
              {angleArcWorld.length > 0 && (
                <path d={pathFromWorldPoints(angleArcWorld, camera)} className="box-angle-arc" />
              )}
              <line
                x1={projectedCircleCenter.x}
                y1={projectedCircleCenter.y}
                x2={projectedCurrent.x}
                y2={projectedCurrent.y}
                className="box-radius"
              />
              <text x={projectedTheta.x + 5} y={projectedTheta.y - 5} className="box-theta">θ</text>
              <circle cx={projectedCurrent.x} cy={projectedCurrent.y} r="6" className="box-current" />
            </g>

            <g className="projection-guides" style={{ opacity: guideOpacity }}>
              <line
                x1={projectedCurrent.x}
                y1={projectedCurrent.y}
                x2={projectedSin.x}
                y2={projectedSin.y}
                className="box-guide box-guide-sin"
              />
              <line
                x1={projectedCurrent.x}
                y1={projectedCurrent.y}
                x2={projectedCos.x}
                y2={projectedCos.y}
                className="box-guide box-guide-cos"
              />
              <circle cx={projectedSin.x} cy={projectedSin.y} r="4.5" className="box-dot box-dot-sin" />
              <circle cx={projectedCos.x} cy={projectedCos.y} r="4.5" className="box-dot box-dot-cos" />
              <text
                x={projectedSin.x + 9}
                y={projectedSin.y - 7}
                className="circle-projection-label circle-projection-label-sin"
              >
                sin
              </text>
              <text
                x={projectedCos.x + 9}
                y={projectedCos.y + 17}
                className="circle-projection-label circle-projection-label-cos"
              >
                cos
              </text>
            </g>

            {view === 'box' && !transitioning && (
              <g className="face-hits">
                <polygon
                  points={pointsString(sinFace, camera)}
                  className="face-hit face-hit-sin"
                  role="button"
                  tabIndex={0}
                  aria-label="サイン面を正面から見る"
                  onClick={(event) => {
                    event.stopPropagation()
                    openFace('sin')
                  }}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' || event.key === ' ') {
                      event.preventDefault()
                      openFace('sin')
                    }
                  }}
                />
                <polygon
                  points={pointsString(cosFace, camera)}
                  className="face-hit face-hit-cos"
                  role="button"
                  tabIndex={0}
                  aria-label="コサイン面を正面から見る"
                  onClick={(event) => {
                    event.stopPropagation()
                    openFace('cos')
                  }}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' || event.key === ' ') {
                      event.preventDefault()
                      openFace('cos')
                    }
                  }}
                />
                <polygon
                  points={pointsString(far, camera)}
                  className="face-hit face-hit-circle"
                  role="button"
                  tabIndex={0}
                  aria-label="単位円を正面から見る"
                  onClick={(event) => {
                    event.stopPropagation()
                    openFace('circle')
                  }}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' || event.key === ' ') {
                      event.preventDefault()
                      openFace('circle')
                    }
                  }}
                />
              </g>
            )}
          </svg>
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
