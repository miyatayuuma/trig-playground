import { describe, expect, it } from 'vitest'
import { canTraverseConcept, conceptLabel, liveConceptEdgesFrom } from './concepts'

describe('concept graph', () => {
  it('exposes unit-circle gateways as live concept transitions', () => {
    expect(canTraverseConcept('trig', 'vector')).toBe(true)
    expect(canTraverseConcept('trig', 'derivative')).toBe(true)
    expect(liveConceptEdgesFrom('trig')).toEqual(expect.arrayContaining([
      expect.objectContaining({ from: 'trig', to: 'vector', reversible: true, status: 'live' }),
      expect.objectContaining({ from: 'trig', to: 'derivative', reversible: true, status: 'live' }),
    ]))
  })

  it('exposes vector components as the next vector route', () => {
    expect(canTraverseConcept('vector', 'vector-components')).toBe(true)
    expect(liveConceptEdgesFrom('vector')).toEqual([
      expect.objectContaining({ from: 'vector', to: 'vector-components', reversible: true, status: 'live' }),
    ])
  })

  it('continues decomposition through addition into dot product', () => {
    expect(canTraverseConcept('vector-components', 'vector-addition')).toBe(true)
    expect(canTraverseConcept('vector-addition', 'dot-product')).toBe(true)
  })

  it('continues zero dot product through diagonalization play', () => {
    expect(canTraverseConcept('dot-product', 'orthogonal-basis')).toBe(true)
    expect(canTraverseConcept('orthogonal-basis', 'matrix')).toBe(true)
    expect(canTraverseConcept('matrix', 'determinant')).toBe(true)
    expect(canTraverseConcept('determinant', 'eigenvector')).toBe(true)
    expect(canTraverseConcept('eigenvector', 'eigenbasis')).toBe(true)
    expect(canTraverseConcept('eigenbasis', 'diagonalization')).toBe(true)
    expect(liveConceptEdgesFrom('eigenvector')).toEqual([
      expect.objectContaining({
        from: 'eigenvector',
        to: 'eigenbasis',
        reversible: true,
        status: 'live',
      }),
    ])
  })

  it('provides stable labels for room chrome', () => {
    expect(conceptLabel('trig')).toBe('UNIT CIRCLE')
    expect(conceptLabel('vector')).toBe('VECTOR')
    expect(conceptLabel('vector-components')).toBe('VECTOR COMPONENTS')
    expect(conceptLabel('vector-addition')).toBe('VECTOR ADDITION')
    expect(conceptLabel('dot-product')).toBe('DOT PRODUCT')
    expect(conceptLabel('orthogonal-basis')).toBe('ORTHOGONAL BASIS')
    expect(conceptLabel('matrix')).toBe('MATRIX TRANSFORMATION')
    expect(conceptLabel('determinant')).toBe('DETERMINANT')
    expect(conceptLabel('eigenvector')).toBe('EIGENVECTOR')
    expect(conceptLabel('eigenbasis')).toBe('EIGENBASIS')
    expect(conceptLabel('diagonalization')).toBe('DIAGONALIZATION')
    expect(conceptLabel('derivative')).toBe('DERIVATIVE')
  })
})
