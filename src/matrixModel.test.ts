import { describe, expect, it } from 'vitest'
import {
  determinantOrientation,
  determinantTargetProgress,
  isDeterminantCollapseTarget,
  matrixDeterminant,
  nearestCollinearVector,
} from './matrixModel'

describe('matrix determinant play', () => {
  it('treats the basis columns as signed area', () => {
    expect(matrixDeterminant({ x: 1, y: 0 }, { x: 0, y: 1 })).toBe(1)
    expect(matrixDeterminant({ x: 1, y: 0 }, { x: 0, y: -1 })).toBe(-1)
  })

  it('reveals the collapse target continuously as the cell flattens', () => {
    const a = { x: 1, y: 0 }
    expect(determinantTargetProgress(a, { x: 0, y: 1 })).toBe(0)
    expect(determinantTargetProgress(a, { x: 1, y: 0.17 })).toBeCloseTo(0.5, 6)
    expect(determinantTargetProgress(a, { x: 1, y: 0.03 })).toBeGreaterThan(0.9)
  })

  it('requires two real axes so shrinking one vector to zero is not an escape', () => {
    expect(isDeterminantCollapseTarget({ x: 1, y: 0 }, { x: 1, y: 0.03 })).toBe(true)
    expect(isDeterminantCollapseTarget({ x: 1, y: 0 }, { x: 0.02, y: 0.01 })).toBe(false)
  })

  it('snaps the moved axis to the nearest collinear direction without changing its length', () => {
    const snapped = nearestCollinearVector({ x: -0.9, y: 0.15 }, { x: 1, y: 0 })
    expect(snapped.x).toBeLessThan(0)
    expect(snapped.y).toBeCloseTo(0, 8)
    expect(Math.hypot(snapped.x, snapped.y)).toBeCloseTo(Math.hypot(0.9, 0.15), 8)
  })

  it('distinguishes preserved, collapsed, and flipped orientation', () => {
    expect(determinantOrientation(1)).toBe(1)
    expect(determinantOrientation(0.0001)).toBe(0)
    expect(determinantOrientation(-1)).toBe(-1)
  })
})
