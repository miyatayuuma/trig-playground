import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import type { Point2 } from './vectorModel'

type Geometry = {
  svg: SVGSVGElement
  origin: Point2
  elbow: Point2
  endpoint: Point2
}

const numberAttr = (element: Element, name: string) => Number(element.getAttribute(name) ?? 0)
const distance = (a: Point2, b: Point2) => Math.hypot(a.x - b.x, a.y - b.y)

const readGeometry = (): Geometry | null => {
  const svg = document.querySelector<SVGSVGElement>('.camera-svg.is-components-room')
  if (!svg) return null

  const axisLines = svg.querySelectorAll<SVGLineElement>('.vector-grid-axis line')
  const endpointElement = svg.querySelector<SVGCircleElement>('.vector-endpoint-ring')
  const elbowElement = svg.querySelector<SVGCircleElement>('.component-elbow')
  if (axisLines.length < 2 || !endpointElement || !elbowElement) return null

  const yAxis = axisLines[0]
  const xAxis = axisLines[1]
  const yStart = { x: numberAttr(yAxis, 'x1'), y: numberAttr(yAxis, 'y1') }
  const yEnd = { x: numberAttr(yAxis, 'x2'), y: numberAttr(yAxis, 'y2') }
  const xStart = { x: numberAttr(xAxis, 'x1'), y: numberAttr(xAxis, 'y1') }
  const xEnd = { x: numberAttr(xAxis, 'x2'), y: numberAttr(xAxis, 'y2') }
  const origin = {
    x: (xStart.x + xEnd.x) / 2,
    y: (yStart.y + yEnd.y) / 2,
  }

  return {
    svg,
    origin,
    elbow: {
      x: numberAttr(elbowElement, 'cx'),
      y: numberAttr(elbowElement, 'cy'),
    },
    endpoint: {
      x: numberAttr(endpointElement, 'cx'),
      y: numberAttr(endpointElement, 'cy'),
    },
  }
}

const sameGeometry = (a: Geometry | null, b: Geometry | null) => {
  if (!a || !b) return a === b
  return a.svg === b.svg
    && distance(a.origin, b.origin) < 0.01
    && distance(a.elbow, b.elbow) < 0.01
    && distance(a.endpoint, b.endpoint) < 0.01
}

export default function ComponentLabelsPortal() {
  const [geometry, setGeometry] = useState<Geometry | null>(null)

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
      attributeFilter: ['class', 'cx', 'cy', 'x1', 'x2', 'y1', 'y2'],
    })

    return () => {
      observer.disconnect()
      cancelAnimationFrame(frame)
    }
  }, [])

  if (!geometry) return null

  const xMid = {
    x: (geometry.origin.x + geometry.elbow.x) / 2,
    y: (geometry.origin.y + geometry.elbow.y) / 2,
  }
  const yMid = {
    x: (geometry.elbow.x + geometry.endpoint.x) / 2,
    y: (geometry.elbow.y + geometry.endpoint.y) / 2,
  }
  const xOffsetY = geometry.endpoint.y < geometry.origin.y ? 24 : -15
  const yOffsetX = geometry.endpoint.x >= geometry.origin.x ? 17 : -17
  const coordinateX = Math.max(140, Math.min(620, geometry.endpoint.x))
  const coordinateY = geometry.endpoint.y < 74 ? geometry.endpoint.y + 30 : geometry.endpoint.y - 19

  return createPortal(
    <g className="component-short-labels" pointerEvents="none" aria-hidden="true">
      <text
        x={xMid.x}
        y={xMid.y + xOffsetY}
        textAnchor="middle"
        className="component-short-label component-short-label-x"
      >
        x = r cos θ
      </text>
      <text
        x={yMid.x + yOffsetX}
        y={yMid.y + 5}
        textAnchor={yOffsetX > 0 ? 'start' : 'end'}
        className="component-short-label component-short-label-y"
      >
        y = r sin θ
      </text>
      <text
        x={coordinateX}
        y={coordinateY}
        textAnchor="middle"
        className="component-coordinate-definition"
      >
        (r cos θ, r sin θ)
      </text>
    </g>,
    geometry.svg,
  )
}
