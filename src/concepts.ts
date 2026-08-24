export type ConceptId =
  | 'trig'
  | 'vector'
  | 'vector-components'
  | 'vector-addition'
  | 'dot-product'
  | 'matrix'
  | 'determinant'
  | 'eigenvector'
  | 'derivative'
  | 'integral'
  | 'complex'
  | 'fourier'
  | 'radians'
  | 'modular'
  | 'number-theory'

export type ConceptStatus = 'live' | 'planned'

export type ConceptNode = {
  id: ConceptId
  label: string
  status: ConceptStatus
}

export type ConceptEdge = {
  from: ConceptId
  to: ConceptId
  gesture: string
  reversible: boolean
  status: ConceptStatus
}

export const CONCEPTS: ConceptNode[] = [
  { id: 'trig', label: 'UNIT CIRCLE', status: 'live' },
  { id: 'vector', label: 'VECTOR', status: 'live' },
  { id: 'vector-components', label: 'VECTOR COMPONENTS', status: 'live' },
  { id: 'vector-addition', label: 'VECTOR ADDITION', status: 'live' },
  { id: 'dot-product', label: 'DOT PRODUCT', status: 'planned' },
  { id: 'matrix', label: 'MATRIX TRANSFORMATION', status: 'planned' },
  { id: 'determinant', label: 'DETERMINANT', status: 'planned' },
  { id: 'eigenvector', label: 'EIGENVECTOR', status: 'planned' },
  { id: 'derivative', label: 'DERIVATIVE', status: 'planned' },
  { id: 'integral', label: 'INTEGRAL', status: 'planned' },
  { id: 'complex', label: 'COMPLEX PLANE', status: 'planned' },
  { id: 'fourier', label: 'FOURIER', status: 'planned' },
  { id: 'radians', label: 'RADIANS', status: 'planned' },
  { id: 'modular', label: 'MODULAR ARITHMETIC', status: 'planned' },
  { id: 'number-theory', label: 'NUMBER THEORY', status: 'planned' },
]

export const CONCEPT_EDGES: ConceptEdge[] = [
  {
    from: 'trig',
    to: 'vector',
    gesture: 'trace the rotating radius from the origin toward its tip',
    reversible: true,
    status: 'live',
  },
  {
    from: 'vector',
    to: 'vector-components',
    gesture: 'extend beyond the outer ring, then place PULL onto the component joint',
    reversible: true,
    status: 'live',
  },
  {
    from: 'vector-components',
    to: 'vector-addition',
    gesture: 'pull a second vector from the dedicated plus handle',
    reversible: true,
    status: 'live',
  },
  { from: 'vector-addition', to: 'dot-product', gesture: 'drop one vector onto the other', reversible: true, status: 'planned' },
  { from: 'vector', to: 'matrix', gesture: 'drag the basis and distort the grid', reversible: true, status: 'planned' },
  { from: 'matrix', to: 'determinant', gesture: 'select a unit area tile', reversible: true, status: 'planned' },
  { from: 'matrix', to: 'eigenvector', gesture: 'find a direction preserved by the transform', reversible: true, status: 'planned' },
  { from: 'trig', to: 'derivative', gesture: 'pull a tangent from a wave point', reversible: true, status: 'planned' },
  { from: 'trig', to: 'integral', gesture: 'sweep area beneath a wave', reversible: true, status: 'planned' },
  { from: 'trig', to: 'complex', gesture: 'reinterpret unit-circle coordinates as a complex number', reversible: true, status: 'planned' },
  { from: 'complex', to: 'fourier', gesture: 'combine multiple rotating vectors', reversible: true, status: 'planned' },
  { from: 'trig', to: 'radians', gesture: 'cut and unwrap the circumference', reversible: true, status: 'planned' },
  { from: 'radians', to: 'modular', gesture: 'join number-line endpoints', reversible: true, status: 'planned' },
  { from: 'modular', to: 'number-theory', gesture: 'inspect repeated cycles and factors', reversible: true, status: 'planned' },
]

export const conceptLabel = (id: ConceptId) => CONCEPTS.find((concept) => concept.id === id)?.label ?? id

export const liveConceptEdgesFrom = (id: ConceptId) =>
  CONCEPT_EDGES.filter((edge) => edge.from === id && edge.status === 'live')

export const canTraverseConcept = (from: ConceptId, to: ConceptId) =>
  CONCEPT_EDGES.some((edge) => edge.from === from && edge.to === to && edge.status === 'live')
