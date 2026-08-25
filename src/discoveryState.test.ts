import { describe, expect, it } from 'vitest'
import { expandDiscoveryWithAncestors } from './discoveryState'

describe('discovery state', () => {
  it('always includes the unit circle', () => {
    expect(expandDiscoveryWithAncestors([])).toContain('trig')
  })

  it('backfills the live path when a deep concept is discovered', () => {
    const discovered = expandDiscoveryWithAncestors(['diagonalization'])
    expect(discovered).toEqual(expect.arrayContaining([
      'trig',
      'vector',
      'vector-components',
      'vector-addition',
      'dot-product',
      'orthogonal-basis',
      'matrix',
      'determinant',
      'eigenvector',
      'eigenbasis',
      'diagonalization',
    ]))
  })

  it('does not reveal planned branch names through ancestry', () => {
    const discovered = expandDiscoveryWithAncestors(['eigenvector'])
    expect(discovered).not.toContain('derivative')
    expect(discovered).not.toContain('complex')
  })
})
