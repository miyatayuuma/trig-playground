import { describe, expect, it } from 'vitest'
import {
  degreesToRadians,
  formatRadians,
  normalizeRadians,
  radiansToDegrees,
  trigValues,
  trigValuesFromRadians,
} from './math'

describe('trigonometry helpers', () => {
  it('converts between degrees and radians', () => {
    expect(degreesToRadians(180)).toBeCloseTo(Math.PI)
    expect(radiansToDegrees(Math.PI / 2)).toBeCloseTo(90)
  })

  it('normalizes radians into one turn', () => {
    expect(normalizeRadians(-Math.PI / 2)).toBeCloseTo((3 * Math.PI) / 2)
    expect(normalizeRadians(5 * Math.PI)).toBeCloseTo(Math.PI)
  })

  it('returns expected values for notable angles', () => {
    expect(trigValues(0).sin).toBeCloseTo(0)
    expect(trigValues(0).cos).toBeCloseTo(1)
    expect(trigValues(90).sin).toBeCloseTo(1)
    expect(trigValues(90).cos).toBeCloseTo(0)
    expect(trigValuesFromRadians(Math.PI).cos).toBeCloseTo(-1)
  })

  it('formats common radian values as pi fractions', () => {
    expect(formatRadians(Math.PI / 4)).toBe('π/4 rad')
    expect(formatRadians(Math.PI)).toBe('π rad')
    expect(formatRadians(Math.PI * 2)).toBe('2π rad')
  })
})
