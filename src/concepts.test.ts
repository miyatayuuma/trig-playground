import { describe, expect, it } from 'vitest'
import { canTraverseConcept, conceptLabel, liveConceptEdgesFrom } from './concepts'

describe('concept graph', () => {
  it('exposes the unit-circle to vector gateway as the first live concept transition', () => {
    expect(canTraverseConcept('trig', 'vector')).toBe(true)
    expect(liveConceptEdgesFrom('trig')).toEqual([
      expect.objectContaining({
        from: 'trig',
        to: 'vector',
        reversible: true,
        status: 'live',
      }),
    ])
  })

  it('does not expose planned transitions as live routes', () => {
    expect(canTraverseConcept('vector', 'dot-product')).toBe(false)
    expect(liveConceptEdgesFrom('vector')).toEqual([])
  })

  it('provides stable labels for room chrome', () => {
    expect(conceptLabel('trig')).toBe('UNIT CIRCLE')
    expect(conceptLabel('vector')).toBe('VECTOR')
  })
})
