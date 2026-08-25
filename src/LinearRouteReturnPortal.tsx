import {
  useEffect,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type PointerEvent as ReactPointerEvent,
} from 'react'
import { createPortal } from 'react-dom'
import { targetDwellProgress } from './vectorModel'

const RETURN_DWELL_MS = 650

type ReturnContext = {
  svg: SVGSVGElement
  card: HTMLElement
  origin: { x: number; y: number }
}

const numberAttr = (element: Element, name: string) => Number(element.getAttribute(name) ?? 0)
const sleep = (ms: number) => new Promise<void>((resolve) => window.setTimeout(resolve, ms))

const readContext = (): ReturnContext | null => {
  const card = document.querySelector<HTMLElement>('.model-card.diagonalization-active')
  const equation = card?.querySelector<SVGTextElement>('.diagonalization-equation')
  const svg = equation?.ownerSVGElement
  if (!card || !equation || !svg) return null

  return {
    svg,
    card,
    origin: {
      x: numberAttr(equation, 'x'),
      y: numberAttr(equation, 'y') - 34,
    },
  }
}

const sameContext = (a: ReturnContext | null, b: ReturnContext | null) =>
  a?.svg === b?.svg
  && a?.card === b?.card
  && Math.abs((a?.origin.x ?? 0) - (b?.origin.x ?? 0)) < 0.01
  && Math.abs((a?.origin.y ?? 0) - (b?.origin.y ?? 0)) < 0.01

const dispatchBack = (svg: SVGSVGElement) => {
  svg.dispatchEvent(new KeyboardEvent('keydown', {
    key: 'Enter',
    code: 'Enter',
    bubbles: true,
  }))
}

const unwindToUnitCircle = async () => {
  for (let step = 0; step < 18; step += 1) {
    if (document.querySelector('.model-card.unit-circle-gateway-active')) return true

    const matrixBack = document.querySelector<HTMLButtonElement>('.matrix-back')
    if (matrixBack) {
      matrixBack.click()
      await sleep(130)
      continue
    }

    const overlayBack = document.querySelector<HTMLButtonElement>('.addition-back')
    if (overlayBack) {
      overlayBack.click()
      await sleep(130)
      continue
    }

    const componentsSvg = document.querySelector<SVGSVGElement>('.camera-svg.is-components-room')
    if (componentsSvg) {
      dispatchBack(componentsSvg)
      await sleep(650)
      continue
    }

    const vectorSvg = document.querySelector<SVGSVGElement>('.camera-svg.is-vector-room')
    if (vectorSvg) {
      dispatchBack(vectorSvg)
      await sleep(850)
      continue
    }

    await sleep(90)
  }
  return document.querySelector('.model-card.unit-circle-gateway-active') !== null
}

export default function LinearRouteReturnPortal() {
  const [context, setContext] = useState<ReturnContext | null>(null)
  const [holding, setHolding] = useState(false)
  const [progress, setProgress] = useState(0)
  const [returning, setReturning] = useState(false)

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
      attributeFilter: ['class'],
    })
    return () => {
      observer.disconnect()
      cancelAnimationFrame(frame)
    }
  }, [])

  useEffect(() => {
    if (!holding || returning) return undefined
    let frame = 0
    let startedAt: number | null = null
    const tick = (now: number) => {
      if (startedAt === null) startedAt = now
      const next = targetDwellProgress(now - startedAt, RETURN_DWELL_MS)
      setProgress(next)
      if (next >= 1) {
        setHolding(false)
        setReturning(true)
        void unwindToUnitCircle().finally(() => {
          window.setTimeout(() => {
            setReturning(false)
            setProgress(0)
          }, 260)
        })
        return
      }
      frame = requestAnimationFrame(tick)
    }
    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [holding, returning])

  const cancelHold = () => {
    if (returning) return
    setHolding(false)
    setProgress(0)
  }

  const handlePointerDown = (event: ReactPointerEvent<SVGCircleElement>) => {
    if (returning) return
    event.stopPropagation()
    setHolding(true)
    setProgress(0)
    event.currentTarget.setPointerCapture(event.pointerId)
  }

  const handlePointerUp = (event: ReactPointerEvent<SVGCircleElement>) => {
    event.stopPropagation()
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId)
    }
    cancelHold()
  }

  const handleKeyDown = (event: ReactKeyboardEvent<SVGCircleElement>) => {
    if (event.key !== 'Enter' && event.key !== ' ') return
    event.preventDefault()
    event.stopPropagation()
    if (returning) return
    setProgress(1)
    setReturning(true)
    void unwindToUnitCircle().finally(() => {
      window.setTimeout(() => {
        setReturning(false)
        setProgress(0)
      }, 260)
    })
  }

  const svgPortal = context
    ? createPortal(
        <g className={`linear-return-gateway ${holding ? 'is-holding' : ''}`}>
          <circle
            cx={context.origin.x}
            cy={context.origin.y}
            r="18"
            className="linear-return-core"
            pointerEvents="none"
          />
          <circle
            cx={context.origin.x}
            cy={context.origin.y}
            r="27"
            pathLength="1"
            className="linear-return-progress"
            strokeDasharray="1"
            strokeDashoffset={1 - progress}
            transform={`rotate(-90 ${context.origin.x} ${context.origin.y})`}
            pointerEvents="none"
          />
          <g className="linear-return-inward-marks" pointerEvents="none">
            <line x1={context.origin.x - 42} y1={context.origin.y} x2={context.origin.x - 28} y2={context.origin.y} />
            <line x1={context.origin.x + 42} y1={context.origin.y} x2={context.origin.x + 28} y2={context.origin.y} />
            <line x1={context.origin.x} y1={context.origin.y - 42} x2={context.origin.x} y2={context.origin.y - 28} />
            <line x1={context.origin.x} y1={context.origin.y + 42} x2={context.origin.x} y2={context.origin.y + 28} />
          </g>
          <circle
            cx={context.origin.x}
            cy={context.origin.y}
            r="40"
            className="linear-return-hit"
            role="button"
            tabIndex={0}
            aria-label="原点を長押しして単位円へ戻る"
            onPointerDown={handlePointerDown}
            onPointerUp={handlePointerUp}
            onPointerCancel={handlePointerUp}
            onKeyDown={handleKeyDown}
          />
        </g>,
        context.svg,
      )
    : null

  return (
    <>
      {svgPortal}
      {returning && (
        <div className="linear-return-wash" aria-hidden="true">
          <span />
        </div>
      )}
    </>
  )
}
