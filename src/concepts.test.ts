import { describe, expect, it } from 'vitest'
import { canTraverseConcept, conceptLabel, liveConceptEdgesFrom } from './concepts'

describe('concept graph', () => {
  it('exposes the unit-circle to vector gateway as a live concept transition', () => {
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

  it('exposes vector components but keeps later vector routes planned', () => {
    expect(canTraverseConcept('vector', 'vector-components')).toBe(true)
    expect(liveConceptEdgesFrom('vector')).toEqual([
      expect.objectContaining({
        from: 'vector',
        to: 'vector-components',
        reversible: true,
        status: 'live',
      }),
    ])
    expect(canTraverseConcept('vector', 'dot-product')).toBe(false)
  })

  it('provides stable labels for room chrome', () => {
    expect(conceptLabel('trig')).toBe('UNIT CIRCLE')
    expect(conceptLabel('vector')).toBe('VECTOR')
    expect(conceptLabel('vector-components')).toBe('VECTOR COMPONENTS')
  })
})
