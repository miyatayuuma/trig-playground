import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'

type BackContext = {
  svg: SVGSVGElement
  card: HTMLElement
  kind: 'vector' | 'components'
}

const readContext = (): BackContext | null => {
  const svg = document.querySelector<SVGSVGElement>('.camera-svg.is-vector-room, .camera-svg.is-components-room')
  const card = document.querySelector<HTMLElement>('.model-card')
  if (!svg || !card) return null

  return {
    svg,
    card,
    kind: svg.classList.contains('is-components-room') ? 'components' : 'vector',
  }
}

const sameContext = (a: BackContext | null, b: BackContext | null) =>
  a?.svg === b?.svg && a?.card === b?.card && a?.kind === b?.kind

const dispatchBack = (svg: SVGSVGElement) => {
  svg.dispatchEvent(new KeyboardEvent('keydown', {
    key: 'Enter',
    code: 'Enter',
    bubbles: true,
  }))
}

export default function MobileRoomBackPortal() {
  const [context, setContext] = useState<BackContext | null>(null)

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

  if (!context) return null

  return createPortal(
    <button
      type="button"
      className="mobile-room-back"
      aria-label={context.kind === 'components' ? 'ベクトル表示に戻る' : '単位円に戻る'}
      title={context.kind === 'components' ? 'VECTORへ戻る' : 'UNIT CIRCLEへ戻る'}
      onClick={() => dispatchBack(context.svg)}
    >
      <span aria-hidden="true">‹</span>
    </button>,
    context.card,
  )
}
