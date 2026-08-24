import { describe, expect, it } from 'vitest'
import {
  clampVectorMagnitude,
  componentPullProgress,
  isComponentGatewayGesture,
  isVectorGatewayGesture,
  screenPointToVector,
  unwrapAngleNear,
  vectorComponentLabel,
} from './vectorModel'

describe('vector gateway gesture', () => {
  const origin = { x: 100, y: 100 }

  it('accepts a long swipe that starts at the origin', () => {
    expect(isVectorGatewayGesture({ x: 108, y: 96 }, { x: 205, y: 120 }, origin)).toBe(true)
  })

  it('rejects swipes that start away from the origin', () => {
    expect(isVectorGatewayGesture({ x: 145, y: 100 }, { x: 240, y: 100 }, origin)).toBe(false)
  })

  it('rejects taps and short drags', () => {
    expect(isVectorGatewayGesture({ x: 100, y: 100 }, { x: 130, y: 118 }, origin)).toBe(false)
  })
})

describe('vector dragging math', () => {
  it('recovers vector coordinates from a skewed screen basis', () => {
    const origin = { x: 10, y: 20 }
    const xBasis = { x: 30, y: 25 }
    const yBasis = { x: 5, y: 50 }
    const point = { x: 37.5, y: 12.5 }

    const vector = screenPointToVector(point, origin, xBasis, yBasis)
    expect(vector.x).toBeCloseTo(1.25, 6)
    expect(vector.y).toBeCloseTo(-0.75, 6)
  })

  it('clamps long vectors without changing direction', () => {
    const vector = clampVectorMagnitude({ x: 3, y: 4 }, 2)
    expect(vector.x).toBeCloseTo(1.2, 6)
    expect(vector.y).toBeCloseTo(1.6, 6)
  })

  it('unwraps a dragged angle near the existing accumulated angle', () => {
    const reference = Math.PI * 4 + 0.1
    expect(unwrapAngleNear(reference, -0.1)).toBeCloseTo(Math.PI * 4 - 0.1, 6)
  })
})

describe('component gateway gesture', () => {
  const start = { x: 200, y: 160 }
  const outward = { x: 0.6, y: -0.8 }

  it('uses only outward travel for preview progress', () => {
    expect(componentPullProgress(start, { x: 244.4, y: 100.8 }, outward, 74)).toBeCloseTo(1, 6)
    expect(componentPullProgress(start, { x: 170, y: 200 }, outward, 74)).toBe(0)
  })

  it('accepts a deliberate outward pull', () => {
    expect(isComponentGatewayGesture(start, { x: 242, y: 104 }, outward)).toBe(true)
  })

  it('rejects sideways drags so endpoint manipulation cannot open the room accidentally', () => {
    expect(isComponentGatewayGesture(start, { x: 275, y: 165 }, outward)).toBe(false)
  })
})

describe('vector component label', () => {
  it('avoids displaying negative zero', () => {
    expect(vectorComponentLabel(-0.0001)).toBe('0.00')
  })
})
