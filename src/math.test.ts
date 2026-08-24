import { describe, expect, it } from 'vitest'
import { degreesToRadians, trigValues } from './math'

describe('trigonometry helpers', () => {
  it('converts degrees to radians', () => {
    expect(degreesToRadians(180)).toBeCloseTo(Math.PI)
  })

  it('returns expected values for notable angles', () => {
    expect(trigValues(0).sin).toBeCloseTo(0)
    expect(trigValues(0).cos).toBeCloseTo(1)
    expect(trigValues(90).sin).toBeCloseTo(1)
    expect(trigValues(90).cos).toBeCloseTo(0)
  })
})
