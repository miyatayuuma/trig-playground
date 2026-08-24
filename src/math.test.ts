import { describe, expect, it } from 'vitest'
import {
  degreesToRadians,
  formatRadians,
  nearestEquivalentAngle,
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

  it('keeps direct manipulation on the nearest continuous turn', () => {
    expect(nearestEquivalentAngle(0, TAU - 0.1)).toBeCloseTo(TAU)
    expect(nearestEquivalentAngle((3 * Math.PI) / 2, -Math.PI / 2 - 0.1)).toBeCloseTo(-Math.PI / 2)
  })

  it('returns expected sine, cosine, and tangent values', () => {
    expect(trigValues(0).sin).toBeCloseTo(0)
    expect(trigValues(0).cos).toBeCloseTo(1)
    expect(trigValues(45).tan).toBeCloseTo(1)
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

const TAU = Math.PI * 2
