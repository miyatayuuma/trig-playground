import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import type { Point2 } from './vectorModel'

type Geometry = {
  svg: SVGSVGElement
  origin: Point2
}

const numberAttr = (element: Element, name: string) => Number(element.getAttribute(name) ?? 0)

const readGeometry = (): Geometry | null => {
  const originElement = document.querySelector<SVGCircleElement>('.vector-gateway-origin')
  const svg = originElement?.ownerSVGElement
  if (!originElement || !svg) return null
  return {
    svg,
    origin: {
      x: numberAttr(originElement, 'cx'),
      y: numberAttr(originElement, 'cy'),
    },
  }
}

const sameGeometry = (a: Geometry | null, b: Geometry | null) => {
  if (!a || !b) return a === b
  return a.svg === b.svg
    && Math.abs(a.origin.x - b.origin.x) < 0.01
    && Math.abs(a.origin.y - b.origin.y) < 0.01
}

export default function ThetaLabelPortal() {
  const [geometry, setGeometry] = useState<Geometry | null>(null)
  const [introActive, setIntroActive] = useState(true)

  useEffect(() => {
    let frame = 0
    const refresh = () => {
      cancelAnimationFrame(frame)
      frame = requestAnimationFrame(() => {
        const next = readGeometry()
        setGeometry((current) => sameGeometry(current, next) ? current : next)
      })
    }

    refresh()
    const observer = new MutationObserver(refresh)
    observer.observe(document.body, {
      subtree: true,
      childList: true,
      attributes: true,
      attributeFilter: ['class', 'cx', 'cy'],
    })

    return () => {
      observer.disconnect()
      cancelAnimationFrame(frame)
    }
  }, [])

  useEffect(() => {
    if (!geometry || !introActive) return undefined
    const timer = window.setTimeout(() => setIntroActive(false), 700)
    return () => window.clearTimeout(timer)
  }, [geometry, introActive])

  if (!geometry) return null

  return createPortal(
    <text
      x={geometry.origin.x + 48}
      y={geometry.origin.y - 36}
      className={`theta-fixed-label ${introActive ? 'theta-fixed-label-intro' : ''}`}
      pointerEvents="none"
      aria-hidden="true"
    >
      θ
    </text>,
    geometry.svg,
  )
}
