import { describe, expect, it } from 'vitest'
import {
  applyMatrix,
  determinantFlipProgress,
  determinantOrientation,
  determinantTargetProgress,
  eigenDirectionParallelCosine,
  eigenDirectionProgress,
  eigenScale,
  isDeterminantCollapseTarget,
  isDeterminantFlipReady,
  isEigenDirectionHit,
  matrixDeterminant,
  nearestCollinearVector,
  nearestEigenDirection,
  realEigenDirections,
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

  it('turns a clearly negative signed area into a perceptible next-gate dwell', () => {
    expect(determinantFlipProgress(0.2)).toBe(0)
    expect(determinantFlipProgress(-0.13)).toBeGreaterThan(0)
    expect(determinantFlipProgress(-0.3)).toBe(1)
    expect(isDeterminantFlipReady(-0.3)).toBe(true)
    expect(isDeterminantFlipReady(-0.05)).toBe(false)
  })
})

describe('eigenvector hunt', () => {
  const a = { x: 1.4, y: 0 }
  const b = { x: 0.7, y: -0.8 }

  it('applies basis columns as a 2x2 matrix', () => {
    expect(applyMatrix(a, b, { x: 2, y: 3 })).toEqual({ x: 4.9, y: -2.4000000000000004 })
  })

  it('finds real invariant directions for a negative-determinant transform', () => {
    const directions = realEigenDirections(a, b)
    expect(directions.length).toBe(2)
    for (const direction of directions) {
      expect(eigenDirectionParallelCosine(a, b, direction)).toBeCloseTo(1, 8)
      expect(isEigenDirectionHit(a, b, direction)).toBe(true)
    }
  })

  it('does not invent a real eigenvector for a pure quarter turn', () => {
    const rotationA = { x: 0, y: 1 }
    const rotationB = { x: -1, y: 0 }
    expect(realEigenDirections(rotationA, rotationB)).toEqual([])
    expect(eigenDirectionProgress(rotationA, rotationB, { x: 1, y: 0 })).toBe(0)
  })

  it('snaps a nearby probe onto the nearest invariant line while preserving probe length', () => {
    const target = realEigenDirections(a, b)[0]
    const probe = { x: target.x * 0.82 - target.y * 0.12, y: target.y * 0.82 + target.x * 0.12 }
    const snapped = nearestEigenDirection(a, b, probe)
    expect(Math.hypot(snapped.x, snapped.y)).toBeCloseTo(Math.hypot(probe.x, probe.y), 8)
    expect(eigenDirectionParallelCosine(a, b, snapped)).toBeCloseTo(1, 8)
    expect(Math.abs(eigenScale(a, b, snapped))).toBeGreaterThan(0.1)
  })
})
