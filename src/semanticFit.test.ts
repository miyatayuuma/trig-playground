import { describe, expect, it } from 'vitest'
import { expandBounds, fitSemanticBounds, unionBounds } from './semanticFit'

describe('semantic safe-frame fitting', () => {
  it('unions geometry and labels into one semantic frame', () => {
    expect(unionBounds([
      { minX: 100, minY: 80, maxX: 500, maxY: 320 },
      { minX: 480, minY: 60, maxX: 560, maxY: 100 },
    ])).toEqual({ minX: 100, minY: 60, maxX: 560, maxY: 320 })
  })

  it('adds explicit breathing room around semantic content', () => {
    expect(expandBounds({ minX: 100, minY: 80, maxX: 500, maxY: 320 }, 20, 12)).toEqual({
      minX: 80,
      minY: 68,
      maxX: 520,
      maxY: 332,
    })
  })

  it('shrinks wide content rather than cropping it', () => {
    const fit = fitSemanticBounds(
      { minX: -40, minY: 80, maxX: 800, maxY: 350 },
      { width: 760, height: 430 },
      { safePaddingX: 32, safePaddingY: 28, maxScale: 1.15 },
    )
    expect(fit.scale).toBeLessThan(1)
    expect(fit.shiftXPercent).toBeCloseTo(0, 6)
  })

  it('recenters asymmetric content while respecting the maximum scale', () => {
    const fit = fitSemanticBounds(
      { minX: 260, minY: 120, maxX: 620, maxY: 310 },
      { width: 760, height: 430 },
      { maxScale: 1.1 },
    )
    expect(fit.scale).toBeLessThanOrEqual(1.1)
    expect(fit.shiftXPercent).toBeLessThan(0)
  })
})
