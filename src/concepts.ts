export type ConceptId =
  | 'trig'
  | 'vector'
  | 'vector-components'
  | 'vector-addition'
  | 'dot-product'
  | 'orthogonal-basis'
  | 'matrix'
  | 'determinant'
  | 'eigenvector'
  | 'eigenbasis'
  | 'diagonalization'
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
  { id: 'dot-product', label: 'DOT PRODUCT', status: 'live' },
  { id: 'orthogonal-basis', label: 'ORTHOGONAL BASIS', status: 'live' },
  { id: 'matrix', label: 'MATRIX TRANSFORMATION', status: 'live' },
  { id: 'determinant', label: 'DETERMINANT', status: 'live' },
  { id: 'eigenvector', label: 'EIGENVECTOR', status: 'live' },
  { id: 'eigenbasis', label: 'EIGENBASIS', status: 'live' },
  { id: 'diagonalization', label: 'DIAGONALIZATION', status: 'live' },
  { id: 'derivative', label: 'DERIVATIVE', status: 'live' },
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
    gesture: 'extend the vector until PULL appears, then place it onto the component joint',
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
  {
    from: 'vector-addition',
    to: 'dot-product',
    gesture: 'hold A+B inside its target, then drop the shadow of B onto A',
    reversible: true,
    status: 'live',
  },
  {
    from: 'dot-product',
    to: 'orthogonal-basis',
    gesture: 'shrink proj_A(B) to zero and hold A dot B at zero until the pair locks perpendicular',
    reversible: true,
    status: 'live',
  },
  {
    from: 'orthogonal-basis',
    to: 'matrix',
    gesture: 'grab either basis tip and let the whole grid move with it',
    reversible: true,
    status: 'live',
  },
  {
    from: 'matrix',
    to: 'determinant',
    gesture: 'squeeze the fundamental cell flat and hold the collapsed space',
    reversible: true,
    status: 'live',
  },
  {
    from: 'determinant',
    to: 'eigenvector',
    gesture: 'flip signed area through zero, then rotate a probe until its original and transformed directions coincide',
    reversible: true,
    status: 'live',
  },
  {
    from: 'eigenvector',
    to: 'eigenbasis',
    gesture: 'keep the first invariant line locked and find the second invariant direction',
    reversible: true,
    status: 'live',
  },
  {
    from: 'eigenbasis',
    to: 'diagonalization',
    gesture: 'let the grid re-express itself along the two invariant directions',
    reversible: true,
    status: 'live',
  },
  {
    from: 'trig',
    to: 'derivative',
    gesture: 'hold a live wave point to reveal its tangent, then drag the contact point along the curve',
    reversible: true,
    status: 'live',
  },
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
