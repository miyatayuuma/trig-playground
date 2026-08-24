import { describe, expect, it } from 'vitest'
import {
  addVectors,
  additionTargetProgress,
  clampVectorMagnitude,
  componentGatewayVisibility,
  componentPullProgress,
  componentTargetProgress,
  isAdditionTargetHit,
  isComponentGatewayGesture,
  isComponentTargetHit,
  isRadiusTraceComplete,
  isRadiusTraceStart,
  isSecondVectorGatewayGesture,
  isVectorGatewayGesture,
  radiusTraceProgress,
  screenPointToVector,
  secondVectorPullProgress,
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

describe('radius trace gateway', () => {
  const origin = { x: 100, y: 100 }
  const endpoint = { x: 220, y: 160 }

  it('only arms close to the origin', () => {
    expect(isRadiusTraceStart({ x: 118, y: 112 }, origin)).toBe(true)
    expect(isRadiusTraceStart({ x: 145, y: 100 }, origin)).toBe(false)
  })

  it('tracks forward progress along the visible radius', () => {
    expect(radiusTraceProgress({ x: 160, y: 130 }, origin, endpoint)).toBeCloseTo(0.5, 6)
    expect(radiusTraceProgress({ x: 208, y: 154 }, origin, endpoint)).toBeCloseTo(0.9, 6)
  })

  it('allows a forgiving finger offset but rejects a clearly different direction', () => {
    expect(radiusTraceProgress({ x: 170, y: 153 }, origin, endpoint)).toBeGreaterThan(0.55)
    expect(radiusTraceProgress({ x: 120, y: 180 }, origin, endpoint)).toBe(0)
  })

  it('opens only after most of the radius has been traced', () => {
    expect(isRadiusTraceComplete({ x: 202, y: 151 }, origin, endpoint)).toBe(true)
    expect(isRadiusTraceComplete({ x: 178, y: 139 }, origin, endpoint)).toBe(false)
    expect(isRadiusTraceComplete({ x: 205, y: 215 }, origin, endpoint)).toBe(false)
  })
})

describe('vector dragging math', () => {
  it('recovers vector coordinates from a skewed screen basis', () => {
    const origin = { x: 10, y: 20 }
    const xBasis = { x: 30, y: 25 }
    const yBasis = { x: 5, y: 50 }
    const point = { x: 38.75, y: 3.75 }

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

describe('component joint puzzle', () => {
  it('only reveals PULL after the vector crosses the outer threshold with two usable components', () => {
    expect(componentGatewayVisibility({ x: 0.92, y: 0.72 }, false)).toBe(true)
    expect(componentGatewayVisibility({ x: 1.08, y: 0.08 }, false)).toBe(false)
    expect(componentGatewayVisibility({ x: 0.7, y: 0.7 }, false)).toBe(false)
  })

  it('uses hysteresis so the PULL handle does not flicker at the threshold', () => {
    expect(componentGatewayVisibility({ x: 0.82, y: 0.68 }, true)).toBe(true)
    expect(componentGatewayVisibility({ x: 0.65, y: 0.62 }, true)).toBe(false)
  })

  it('brightens the decomposition preview as the handle nears the joint', () => {
    const target = { x: 300, y: 200 }
    expect(componentTargetProgress({ x: 150, y: 200 }, target)).toBe(0)
    expect(componentTargetProgress({ x: 225, y: 200 }, target)).toBeCloseTo(0.5, 6)
    expect(componentTargetProgress({ x: 292, y: 205 }, target)).toBeGreaterThan(0.9)
  })

  it('snaps only inside the joint hit radius', () => {
    const target = { x: 300, y: 200 }
    expect(isComponentTargetHit({ x: 320, y: 210 }, target)).toBe(true)
    expect(isComponentTargetHit({ x: 335, y: 200 }, target)).toBe(false)
  })
})

describe('second vector gateway', () => {
  const origin = { x: 380, y: 215 }
  const handle = { x: 328, y: 267 }

  it('shows continuous pull progress without depending on direction', () => {
    expect(secondVectorPullProgress(handle, { x: 400, y: 267 }, 72)).toBe(1)
    expect(secondVectorPullProgress(handle, { x: 346, y: 267 }, 72)).toBeCloseTo(0.25, 6)
  })

  it('requires a deliberate pull and an endpoint away from the origin', () => {
    expect(isSecondVectorGatewayGesture(handle, { x: 270, y: 315 }, origin)).toBe(true)
    expect(isSecondVectorGatewayGesture(handle, { x: 345, y: 250 }, origin)).toBe(false)
    expect(isSecondVectorGatewayGesture(handle, { x: 382, y: 217 }, origin)).toBe(false)
  })

  it('adds vectors component-wise', () => {
    expect(addVectors({ x: 0.8, y: -0.2 }, { x: -0.3, y: 0.7 })).toEqual({ x: 0.5, y: 0.49999999999999994 })
  })
})

describe('vector addition lock', () => {
  const target = { x: 1.15, y: 0.85 }

  it('reveals the target progressively as the resultant approaches it', () => {
    expect(additionTargetProgress({ x: 0.81, y: 0.85 }, target)).toBeCloseTo(0, 12)
    expect(additionTargetProgress({ x: 0.98, y: 0.85 }, target)).toBeCloseTo(0.5, 6)
    expect(additionTargetProgress({ x: 1.1, y: 0.85 }, target)).toBeGreaterThan(0.8)
  })

  it('opens only when A + B enters the target tolerance', () => {
    expect(isAdditionTargetHit({ x: 1.08, y: 0.8 }, target)).toBe(true)
    expect(isAdditionTargetHit({ x: 0.98, y: 0.85 }, target)).toBe(false)
  })
})

describe('vector component label', () => {
  it('avoids displaying negative zero', () => {
    expect(vectorComponentLabel(-0.0001)).toBe('0.00')
  })
})
