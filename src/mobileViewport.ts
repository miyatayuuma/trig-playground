export type ViewportMetrics = {
  width: number
  height: number
}

type VisualViewportLike = {
  width: number
  height: number
  scale: number
}

export const resolveViewportMetrics = (
  visualViewport: VisualViewportLike | null,
  innerWidth: number,
  innerHeight: number,
): ViewportMetrics => {
  if (visualViewport && Math.abs(visualViewport.scale - 1) < 0.02) {
    return {
      width: Math.max(1, Math.round(visualViewport.width)),
      height: Math.max(1, Math.round(visualViewport.height)),
    }
  }

  return {
    width: Math.max(1, Math.round(innerWidth)),
    height: Math.max(1, Math.round(innerHeight)),
  }
}

export const installMobileViewport = () => {
  const root = document.documentElement
  let frame = 0

  const sync = () => {
    cancelAnimationFrame(frame)
    frame = requestAnimationFrame(() => {
      const visualViewport = window.visualViewport
      const metrics = resolveViewportMetrics(
        visualViewport
          ? {
              width: visualViewport.width,
              height: visualViewport.height,
              scale: visualViewport.scale,
            }
          : null,
        window.innerWidth,
        window.innerHeight,
      )

      root.style.setProperty('--app-height', `${metrics.height}px`)
      root.style.setProperty('--app-width', `${metrics.width}px`)
      root.dataset.mobileBrowser = window.matchMedia('(hover: none) and (pointer: coarse)').matches
        ? 'true'
        : 'false'
    })
  }

  sync()
  window.addEventListener('resize', sync, { passive: true })
  window.addEventListener('orientationchange', sync, { passive: true })
  window.visualViewport?.addEventListener('resize', sync, { passive: true })

  return () => {
    cancelAnimationFrame(frame)
    window.removeEventListener('resize', sync)
    window.removeEventListener('orientationchange', sync)
    window.visualViewport?.removeEventListener('resize', sync)
  }
}
