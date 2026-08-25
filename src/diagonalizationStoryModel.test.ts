import { describe, expect, it } from 'vitest'
import {
  applyEigenTransform,
  crossingPulse,
  diagonalizationStoryFrame,
  eigenCoordinates,
  negativeScaleCrossingProgress,
  orientDirectionNear,
} from './diagonalizationStoryModel'

describe('diagonalization story geometry', () => {
  it('reconstructs the same transform from two eigen directions and scales', () => {
    const v1 = { x: 1, y: 1 }
    const v2 = { x: 1, y: -1 }
    const point = { x: 3, y: 1 }

    expect(eigenCoordinates(point, v1, v2)).toEqual({ x: 2, y: 1 })
    expect(applyEigenTransform(point, v1, v2, 2, -1)).toEqual({ x: 3, y: 5 })
  })

  it('orients an eigen line toward the nearby visible axis without changing the line', () => {
    expect(orientDirectionNear({ x: -1, y: 0 }, { x: 1, y: 0 })).toEqual({ x: 1, y: -0 })
  })

  it('moves through world distortion, reframing, reset, and independent eigen scaling', () => {
    expect(diagonalizationStoryFrame(0.1).scene).toBe('world')
    expect(diagonalizationStoryFrame(0.4).scene).toBe('reframe')
    expect(diagonalizationStoryFrame(0.58).scene).toBe('reset')
    expect(diagonalizationStoryFrame(0.8).scene).toBe('eigen')
    expect(diagonalizationStoryFrame(0.9).scaleEmphasis).toBeGreaterThan(0.9)
  })

  it('locates and highlights the origin crossing for a negative eigenvalue', () => {
    const crossing = negativeScaleCrossingProgress(-1.5)
    expect(crossing).toBeCloseTo(0.4)
    expect(crossingPulse(crossing ?? 0, -1.5)).toBeCloseTo(1)
    expect(negativeScaleCrossingProgress(0.65)).toBeNull()
  })
})
