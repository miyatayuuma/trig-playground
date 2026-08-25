import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import {
  boundsFromRect,
  fitSemanticBounds,
  fitWidthPriorityBounds,
  unionBounds,
  type SemanticBounds,
} from './semanticFit'

const VIEW_WIDTH = 760
const VIEW_HEIGHT = 430
const PHONE_SURFACE_QUERY = '(max-width: 760px), (hover: none) and (pointer: coarse) and (max-width: 1024px)'

type FocusMode = 'box' | 'circle' | 'sin' | 'cos'

type FocusContext = {
  svg: SVGSVGElement
  card: HTMLElement
  mode: FocusMode
}

const readFocusContext = (): FocusContext | null => {
  const card = document.querySelector<HTMLElement>('.model-card')
  const modeText = document.querySelector<HTMLElement>('.model-mode')?.textContent?.trim().toLowerCase()
  if (!card || (modeText !== 'box' && modeText !== 'circle' && modeText !== 'sin' && modeText !== 'cos')) return null

  const svg = modeText === 'box'
    ? document.querySelector<SVGSVGElement>('.camera-svg.is-box-view')
    : document.querySelector<SVGSVGElement>(
        '.camera-svg.is-focus-view:not(.is-vector-room):not(.is-components-room)',
      )
  if (!svg) return null
  return { svg, card, mode: modeText }
}

const sameContext = (a: FocusContext | null, b: FocusContext | null) =>
  a?.svg === b?.svg && a?.card === b?.card && a?.mode === b?.mode

const elementBounds = (element: SVGGraphicsElement): SemanticBounds | null => {
  try {
    const box = element.getBBox()
    if (!Number.isFinite(box.x) || !Number.isFinite(box.y) || box.width < 0 || box.height < 0) return null
    return boundsFromRect(box.x, box.y, box.width, box.height)
  } catch {
    return null
  }
}

export default function FocusSafeFramePortal() {
  const [context, setContext] = useState<FocusContext | null>(null)
  const definitionRef = useRef<SVGTextElement | null>(null)
  const axisRef = useRef<SVGTextElement | null>(null)

  useEffect(() => {
    let frame = 0
    const refreshContext = () => {
      cancelAnimationFrame(frame)
      frame = requestAnimationFrame(() => {
        const next = readFocusContext()
        setContext((current) => sameContext(current, next) ? current : next)
      })
    }

    refreshContext()
    const observer = new MutationObserver(refreshContext)
    observer.observe(document.body, {
      subtree: true,
      childList: true,
      characterData: true,
      attributes: true,
      attributeFilter: ['class'],
    })

    return () => {
      observer.disconnect()
      cancelAnimationFrame(frame)
    }
  }, [])

  useEffect(() => {
    if (!context) return undefined

    const { svg, card, mode } = context
    let frame = 0

    const sync = () => {
      cancelAnimationFrame(frame)
      frame = requestAnimationFrame(() => {
        let semanticElements: SVGGraphicsElement[] = []
        const maxScale = 1.12
        const isPhoneSurface = window.matchMedia(PHONE_SURFACE_QUERY).matches

        if (mode === 'box') {
          const candidates = [
            ...Array.from(svg.querySelectorAll<SVGGraphicsElement>('.box-edges')),
            ...Array.from(svg.querySelectorAll<SVGGraphicsElement>('.box-wave-trail')),
            ...Array.from(svg.querySelectorAll<SVGGraphicsElement>('.circle-plane-details')),
            ...Array.from(svg.querySelectorAll<SVGGraphicsElement>('.box-face-circle')),
          ]
          const bounds = unionBounds(
            candidates
              .map(elementBounds)
              .filter((value): value is SemanticBounds => value !== null),
          )
          if (!bounds) return

          const fit = fitSemanticBounds(bounds, { width: VIEW_WIDTH, height: VIEW_HEIGHT }, {
            safePaddingX: isPhoneSurface ? 46 : 62,
            safePaddingY: isPhoneSurface ? 42 : 54,
            maxScale: isPhoneSurface ? 1.72 : 1.18,
          })

          svg.style.setProperty('--box-fit-scale', fit.scale.toFixed(4))
          svg.style.setProperty('--box-fit-x', `${fit.shiftXPercent.toFixed(3)}%`)
          svg.style.setProperty('--box-fit-y', `${fit.shiftYPercent.toFixed(3)}%`)
          card.classList.add('box-safe-frame-active')
          return
        }

        if (mode === 'circle') {
          const circle = svg.querySelector<SVGGraphicsElement>('.box-circle')
          if (!circle) return
          const circleBounds = elementBounds(circle)
          if (!circleBounds) return

          let fit
          if (isPhoneSurface) {
            fit = fitWidthPriorityBounds(circleBounds, { width: VIEW_WIDTH, height: VIEW_HEIGHT }, {
              safePaddingX: 30,
              maxScale: 2.08,
            })
          } else {
            semanticElements = [circle]
            svg.querySelectorAll<SVGGraphicsElement>(
              '.unit-circle-definition-label, .unit-circle-coordinate-definition, .theta-fixed-label',
            ).forEach((element) => semanticElements.push(element))
            const bounds = unionBounds(
              semanticElements
                .map(elementBounds)
                .filter((value): value is SemanticBounds => value !== null),
            )
            if (!bounds) return
            fit = fitSemanticBounds(bounds, { width: VIEW_WIDTH, height: VIEW_HEIGHT }, {
              safePaddingX: 42,
              safePaddingY: 38,
              maxScale: 1.55,
            })
          }

          svg.style.setProperty('--focus-fit-scale', fit.scale.toFixed(4))
          svg.style.setProperty('--focus-fit-x', `${fit.shiftXPercent.toFixed(3)}%`)
          svg.style.setProperty('--focus-fit-y', `${fit.shiftYPercent.toFixed(3)}%`)
          card.classList.add('focus-safe-frame-active', 'focus-safe-frame-circle')
          return
        }

        const face = svg.querySelector<SVGGraphicsElement>(`.box-face-${mode}`)
        const dot = svg.querySelector<SVGCircleElement>(`.box-dot-${mode}`)
        if (!face || !dot || !definitionRef.current || !axisRef.current) return

        const faceBounds = elementBounds(face)
        if (!faceBounds) return

        const centerX = (faceBounds.minX + faceBounds.maxX) / 2
        const centerY = (faceBounds.minY + faceBounds.maxY) / 2
        const dotX = Number(dot.getAttribute('cx') ?? centerX)
        const dotY = Number(dot.getAttribute('cy') ?? centerY)
        const placeLeft = dotX >= centerX
        const placeBelow = dotY <= centerY

        definitionRef.current.setAttribute('x', String(dotX + (placeLeft ? -13 : 13)))
        definitionRef.current.setAttribute('y', String(dotY + (placeBelow ? 22 : -12)))
        definitionRef.current.setAttribute('text-anchor', placeLeft ? 'end' : 'start')

        const waveLines = Array.from(svg.querySelectorAll<SVGLineElement>(`.box-wave-${mode}`))
        const first = waveLines[0]
        const last = waveLines[waveLines.length - 1]
        const startX = first ? Number(first.getAttribute('x1') ?? centerX) : centerX
        const endX = last ? Number(last.getAttribute('x2') ?? centerX) : centerX
        axisRef.current.textContent = endX >= startX ? 'θ →' : '← θ'
        axisRef.current.setAttribute('x', String(centerX))
        axisRef.current.setAttribute('y', String(faceBounds.maxY - 12))
        axisRef.current.setAttribute('text-anchor', 'middle')

        semanticElements = [face, definitionRef.current, axisRef.current]
        waveLines.forEach((line) => semanticElements.push(line))

        const bounds = unionBounds(
          semanticElements
            .map(elementBounds)
            .filter((value): value is SemanticBounds => value !== null),
        )
        if (!bounds) return

        const fit = fitSemanticBounds(bounds, { width: VIEW_WIDTH, height: VIEW_HEIGHT }, {
          safePaddingX: 38,
          safePaddingY: 34,
          maxScale,
        })

        svg.style.setProperty('--focus-fit-scale', fit.scale.toFixed(4))
        svg.style.setProperty('--focus-fit-x', `${fit.shiftXPercent.toFixed(3)}%`)
        svg.style.setProperty('--focus-fit-y', `${fit.shiftYPercent.toFixed(3)}%`)
        card.classList.add('focus-safe-frame-active', `focus-safe-frame-${mode}`)
      })
    }

    sync()
    const observer = new MutationObserver(sync)
    observer.observe(svg, {
      subtree: true,
      childList: true,
      attributes: true,
      attributeFilter: ['points', 'cx', 'cy', 'x1', 'x2', 'y1', 'y2'],
    })
    window.addEventListener('resize', sync)

    return () => {
      observer.disconnect()
      window.removeEventListener('resize', sync)
      cancelAnimationFrame(frame)
      svg.style.removeProperty('--focus-fit-scale')
      svg.style.removeProperty('--focus-fit-x')
      svg.style.removeProperty('--focus-fit-y')
      svg.style.removeProperty('--box-fit-scale')
      svg.style.removeProperty('--box-fit-x')
      svg.style.removeProperty('--box-fit-y')
      card.classList.remove(
        'box-safe-frame-active',
        'focus-safe-frame-active',
        'focus-safe-frame-circle',
        'focus-safe-frame-sin',
        'focus-safe-frame-cos',
      )
    }
  }, [context])

  if (!context || context.mode === 'circle' || context.mode === 'box') return null

  return createPortal(
    <g className={`focus-semantic-labels focus-semantic-labels-${context.mode}`} pointerEvents="none" aria-hidden="true">
      <text ref={definitionRef} className={`focus-definition-label focus-definition-label-${context.mode}`}>
        {context.mode === 'sin' ? 'sin θ' : 'cos θ'}
      </text>
      <text ref={axisRef} className="focus-angle-axis-label">θ →</text>
    </g>,
    context.svg,
  )
}
