import {
  useEffect,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type PointerEvent as ReactPointerEvent,
} from 'react'
import { createPortal } from 'react-dom'
import {
  markConceptDiscovered,
  readDiscoverySnapshot,
  subscribeDiscoveries,
} from './discoveryState'
import { targetDwellProgress, type Point2 } from './vectorModel'
import {
  nearestPointOnPolyline,
  normalizedSegmentDirection,
  pointOnSegment,
  tangentEndpoints,
  type Segment2,
} from './waveTangentModel'

const VIEW_WIDTH = 760
const VIEW_HEIGHT = 430
const TANGENT_REVEAL_DWELL_MS = 520

type WaveKind = 'sin' | 'cos'

type WaveContext = {
  svg: SVGSVGElement
  card: HTMLElement
  toolbar: HTMLElement | null
  dock: HTMLElement | null
  kind: WaveKind
}

type Anchor = {
  index: number
  t: number
}

type ProbeVisual = {
  point: Point2
  direction: Point2
}

const numberAttr = (element: Element, name: string) => Number(element.getAttribute(name) ?? 0)

const readContext = (): WaveContext | null => {
  const card = document.querySelector<HTMLElement>('.model-card.focus-safe-frame-sin, .model-card.focus-safe-frame-cos')
  const svg = card?.querySelector<SVGSVGElement>('.camera-svg.is-focus-view:not(.is-vector-room):not(.is-components-room)')
  if (!card || !svg) return null
  const kind: WaveKind = card.classList.contains('focus-safe-frame-sin') ? 'sin' : 'cos'
  return {
    svg,
    card,
    toolbar: document.querySelector<HTMLElement>('.model-toolbar'),
    dock: document.querySelector<HTMLElement>('.topbar'),
    kind,
  }
}

const sameContext = (a: WaveContext | null, b: WaveContext | null) =>
  a?.svg === b?.svg && a?.card === b?.card && a?.kind === b?.kind

const readSegments = (context: WaveContext): Segment2[] =>
  Array.from(context.svg.querySelectorAll<SVGLineElement>(`.box-wave-${context.kind}`)).map((line) => ({
    start: { x: numberAttr(line, 'x1'), y: numberAttr(line, 'y1') },
    end: { x: numberAttr(line, 'x2'), y: numberAttr(line, 'y2') },
  }))

const readDot = (context: WaveContext): Point2 | null => {
  const dot = context.svg.querySelector<SVGCircleElement>(`.box-dot-${context.kind}`)
  if (!dot) return null
  return { x: numberAttr(dot, 'cx'), y: numberAttr(dot, 'cy') }
}

const clientToSvgPoint = (svg: SVGSVGElement, clientX: number, clientY: number): Point2 => {
  const rect = svg.getBoundingClientRect()
  if (rect.width <= 0 || rect.height <= 0) return { x: 0, y: 0 }
  return {
    x: ((clientX - rect.left) / rect.width) * VIEW_WIDTH,
    y: ((clientY - rect.top) / rect.height) * VIEW_HEIGHT,
  }
}

export default function WaveTangentPortal() {
  const [context, setContext] = useState<WaveContext | null>(null)
  const [unlocked, setUnlocked] = useState(() => readDiscoverySnapshot().discovered.includes('diagonalization'))
  const [dot, setDot] = useState<Point2 | null>(null)
  const [holding, setHolding] = useState(false)
  const [holdProgress, setHoldProgress] = useState(0)
  const [active, setActive] = useState(false)
  const [explored, setExplored] = useState(false)
  const [probe, setProbe] = useState<ProbeVisual | null>(null)
  const anchorRef = useRef<Anchor | null>(null)
  const exploredRef = useRef(false)

  useEffect(() => subscribeDiscoveries((snapshot) => {
    setUnlocked(snapshot.discovered.includes('diagonalization'))
  }), [])

  useEffect(() => {
    let frame = 0
    const refresh = () => {
      cancelAnimationFrame(frame)
      frame = requestAnimationFrame(() => {
        const next = readContext()
        setContext((current) => sameContext(current, next) ? current : next)
        if (!next) {
          setActive(false)
          setExplored(false)
          exploredRef.current = false
          anchorRef.current = null
          setProbe(null)
          setHolding(false)
          setHoldProgress(0)
        }
      })
    }

    refresh()
    const observer = new MutationObserver(refresh)
    observer.observe(document.body, {
      subtree: true,
      childList: true,
      attributes: true,
      attributeFilter: ['class'],
    })
    return () => {
      observer.disconnect()
      cancelAnimationFrame(frame)
    }
  }, [])

  useEffect(() => {
    if (!context || !unlocked) return undefined
    let frame = 0
    const tick = () => {
      const nextDot = readDot(context)
      if (nextDot) {
        setDot((current) => current
          && Math.hypot(current.x - nextDot.x, current.y - nextDot.y) < 0.25
          ? current
          : nextDot)
      }

      const anchor = anchorRef.current
      if (active && anchor) {
        const lines = context.svg.querySelectorAll<SVGLineElement>(`.box-wave-${context.kind}`)
        const line = lines[anchor.index]
        if (line) {
          const segment: Segment2 = {
            start: { x: numberAttr(line, 'x1'), y: numberAttr(line, 'y1') },
            end: { x: numberAttr(line, 'x2'), y: numberAttr(line, 'y2') },
          }
          const nextProbe = {
            point: pointOnSegment(segment, anchor.t),
            direction: normalizedSegmentDirection(segment),
          }
          setProbe((current) => current
            && Math.hypot(current.point.x - nextProbe.point.x, current.point.y - nextProbe.point.y) < 0.2
            && Math.hypot(current.direction.x - nextProbe.direction.x, current.direction.y - nextProbe.direction.y) < 0.002
            ? current
            : nextProbe)
        }
      }
      frame = requestAnimationFrame(tick)
    }
    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [active, context, unlocked])

  useEffect(() => {
    const card = context?.card
    const toolbar = context?.toolbar
    const dock = context?.dock
    if (!card) return undefined
    card.classList.toggle('tangent-ready', unlocked && !active)
    card.classList.toggle('tangent-active', active)
    card.classList.toggle('derivative-active', active && explored)
    toolbar?.classList.toggle('tangent-overlay-active', active)
    dock?.classList.toggle('tangent-overlay-active', active)
    return () => {
      card.classList.remove('tangent-ready', 'tangent-active', 'derivative-active')
      toolbar?.classList.remove('tangent-overlay-active')
      dock?.classList.remove('tangent-overlay-active')
    }
  }, [active, context, explored, unlocked])

  useEffect(() => {
    if (!holding || !context || !dot || active) return undefined
    let frame = 0
    let startedAt: number | null = null
    const tick = (now: number) => {
      if (startedAt === null) startedAt = now
      const next = targetDwellProgress(now - startedAt, TANGENT_REVEAL_DWELL_MS)
      setHoldProgress(next)
      if (next >= 1) {
        const segments = readSegments(context)
        const nearest = nearestPointOnPolyline(dot, segments)
        if (nearest) {
          anchorRef.current = { index: nearest.index, t: nearest.t }
          setProbe({ point: nearest.point, direction: nearest.direction })
          setActive(true)
        }
        setHolding(false)
        setHoldProgress(0)
        return
      }
      frame = requestAnimationFrame(tick)
    }
    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [active, context, dot, holding])

  if (!context || !unlocked || !dot) return null

  const beginHold = (event: ReactPointerEvent<SVGCircleElement>) => {
    if (active) return
    event.stopPropagation()
    setHolding(true)
    setHoldProgress(0)
    event.currentTarget.setPointerCapture(event.pointerId)
  }

  const endHold = (event: ReactPointerEvent<SVGCircleElement>) => {
    event.stopPropagation()
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId)
    }
    if (!active) {
      setHolding(false)
      setHoldProgress(0)
    }
  }

  const handleEntryKeyDown = (event: ReactKeyboardEvent<SVGCircleElement>) => {
    if (event.key !== 'Enter' && event.key !== ' ') return
    event.preventDefault()
    const segments = readSegments(context)
    const nearest = nearestPointOnPolyline(dot, segments)
    if (!nearest) return
    anchorRef.current = { index: nearest.index, t: nearest.t }
    setProbe({ point: nearest.point, direction: nearest.direction })
    setActive(true)
  }

  const handleProbePointerDown = (event: ReactPointerEvent<SVGCircleElement>) => {
    if (!active) return
    event.stopPropagation()
    event.currentTarget.setPointerCapture(event.pointerId)
  }

  const handleProbePointerMove = (event: ReactPointerEvent<SVGCircleElement>) => {
    if (!active || !event.currentTarget.hasPointerCapture(event.pointerId)) return
    event.stopPropagation()
    const pointer = clientToSvgPoint(context.svg, event.clientX, event.clientY)
    const nearest = nearestPointOnPolyline(pointer, readSegments(context))
    if (!nearest) return
    anchorRef.current = { index: nearest.index, t: nearest.t }
    setProbe({ point: nearest.point, direction: nearest.direction })
    if (!exploredRef.current) {
      exploredRef.current = true
      setExplored(true)
      markConceptDiscovered('derivative')
    }
  }

  const handleProbePointerUp = (event: ReactPointerEvent<SVGCircleElement>) => {
    event.stopPropagation()
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId)
    }
  }

  const handleProbeKeyDown = (event: ReactKeyboardEvent<SVGCircleElement>) => {
    if (!active || !anchorRef.current) return
    const direction = event.key === 'ArrowLeft' || event.key === 'ArrowUp'
      ? -1
      : event.key === 'ArrowRight' || event.key === 'ArrowDown'
        ? 1
        : 0
    if (!direction) return
    event.preventDefault()
    const segments = readSegments(context)
    const nextIndex = Math.max(0, Math.min(segments.length - 1, anchorRef.current.index + direction))
    anchorRef.current = { index: nextIndex, t: 0.5 }
    const segment = segments[nextIndex]
    if (segment) {
      setProbe({ point: pointOnSegment(segment, 0.5), direction: normalizedSegmentDirection(segment) })
    }
    if (!exploredRef.current) {
      exploredRef.current = true
      setExplored(true)
      markConceptDiscovered('derivative')
    }
  }

  const closeTangent = () => {
    setActive(false)
    setExplored(false)
    exploredRef.current = false
    anchorRef.current = null
    setProbe(null)
    setHolding(false)
    setHoldProgress(0)
  }

  const tangent = probe ? tangentEndpoints(probe.point, probe.direction, 135) : null

  const svgPortal = createPortal(
    <g className={`wave-tangent-extension ${active ? 'is-active' : 'is-ready'} ${explored ? 'is-explored' : ''}`}>
      {!active && (
        <>
          <circle cx={dot.x} cy={dot.y} r="14" className="tangent-entry-ring" pointerEvents="none" />
          <circle
            cx={dot.x}
            cy={dot.y}
            r="20"
            pathLength="1"
            className="tangent-entry-dwell"
            strokeDasharray="1"
            strokeDashoffset={1 - holdProgress}
            transform={`rotate(-90 ${dot.x} ${dot.y})`}
            pointerEvents="none"
          />
          <circle
            cx={dot.x}
            cy={dot.y}
            r="34"
            className="tangent-entry-hit"
            role="button"
            tabIndex={0}
            aria-label="波の点を長押しして接線を引く"
            onPointerDown={beginHold}
            onPointerUp={endHold}
            onPointerCancel={endHold}
            onKeyDown={handleEntryKeyDown}
          />
        </>
      )}

      {active && probe && tangent && (
        <>
          <line
            x1={tangent.start.x}
            y1={tangent.start.y}
            x2={tangent.end.x}
            y2={tangent.end.y}
            className="tangent-live-line"
            pointerEvents="none"
          />
          <circle cx={probe.point.x} cy={probe.point.y} r="10" className="tangent-live-point" pointerEvents="none" />
          <circle
            cx={probe.point.x}
            cy={probe.point.y}
            r="36"
            className="tangent-probe-hit"
            role="slider"
            tabIndex={0}
            aria-label="接点。波に沿って動かすと接線の向きが変わる"
            onPointerDown={handleProbePointerDown}
            onPointerMove={handleProbePointerMove}
            onPointerUp={handleProbePointerUp}
            onPointerCancel={handleProbePointerUp}
            onKeyDown={handleProbeKeyDown}
          />
        </>
      )}
    </g>,
    context.svg,
  )

  const toolbarPortal = active && context.toolbar
    ? createPortal(
        <>
          <span className="model-mode tangent-mode-label">{explored ? 'DERIVATIVE' : 'TANGENT'}</span>
          {!explored && <span className="gateway-whisper tangent-whisper">drag the bright point</span>}
        </>,
        context.toolbar,
      )
    : null

  const dockPortal = active && context.dock
    ? createPortal(
        <div className="tangent-bottom-status" aria-live="polite">
          <strong>{explored ? 'DERIVATIVE' : 'TANGENT'}</strong>
          <small>{explored ? 'the tangent turns with the point' : 'move the point along the wave'}</small>
        </div>,
        context.dock,
      )
    : null

  const backPortal = active
    ? createPortal(
        <button type="button" className="tangent-back" aria-label={`${context.kind.toUpperCase()}表示に戻る`} onClick={closeTangent}>
          <span aria-hidden="true">‹</span>
        </button>,
        context.card,
      )
    : null

  return (
    <>
      {svgPortal}
      {toolbarPortal}
      {dockPortal}
      {backPortal}
    </>
  )
}
