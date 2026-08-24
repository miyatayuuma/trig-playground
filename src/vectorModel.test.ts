import { describe, expect, it } from 'vitest'
import { isVectorGatewayGesture, vectorComponentLabel } from './vectorModel'

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

describe('vector component label', () => {
  it('avoids displaying negative zero', () => {
    expect(vectorComponentLabel(-0.0001)).toBe('0.00')
  })
})
