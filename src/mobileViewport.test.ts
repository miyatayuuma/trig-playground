import { describe, expect, it } from 'vitest'
import { resolveViewportMetrics } from './mobileViewport'

describe('resolveViewportMetrics', () => {
  it('uses the visual viewport at normal browser scale', () => {
    expect(resolveViewportMetrics({ width: 390.4, height: 701.6, scale: 1 }, 390, 780)).toEqual({
      width: 390,
      height: 702,
    })
  })

  it('falls back to the layout viewport while the user is pinch zooming', () => {
    expect(resolveViewportMetrics({ width: 260, height: 470, scale: 1.5 }, 390, 780)).toEqual({
      width: 390,
      height: 780,
    })
  })

  it('falls back when VisualViewport is unavailable', () => {
    expect(resolveViewportMetrics(null, 412.2, 732.7)).toEqual({
      width: 412,
      height: 733,
    })
  })
})
