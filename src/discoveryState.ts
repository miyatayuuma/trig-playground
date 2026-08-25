import { CONCEPT_EDGES, type ConceptId } from './concepts'

export const DISCOVERY_STORAGE_KEY = 'math-labyrinth.discoveries.v1'
export const DISCOVERY_EVENT = 'mathlab:discovery'

export type DiscoverySnapshot = {
  discovered: ConceptId[]
  latest: ConceptId | null
}

const unique = (values: ConceptId[]) => Array.from(new Set(values))

export const expandDiscoveryWithAncestors = (ids: ConceptId[]): ConceptId[] => {
  const discovered = new Set<ConceptId>(['trig', ...ids])
  let changed = true
  while (changed) {
    changed = false
    for (const edge of CONCEPT_EDGES) {
      if (edge.status !== 'live' || !discovered.has(edge.to) || discovered.has(edge.from)) continue
      discovered.add(edge.from)
      changed = true
    }
  }
  return unique(Array.from(discovered))
}

const readStored = (): ConceptId[] => {
  if (typeof window === 'undefined') return ['trig']
  try {
    const raw = window.localStorage.getItem(DISCOVERY_STORAGE_KEY)
    if (!raw) return ['trig']
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? expandDiscoveryWithAncestors(parsed as ConceptId[]) : ['trig']
  } catch {
    return ['trig']
  }
}

const writeStored = (ids: ConceptId[]) => {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(DISCOVERY_STORAGE_KEY, JSON.stringify(ids))
  } catch {
    // Storage can be unavailable in private/restricted browser contexts. Discovery
    // still works for the current render through the dispatched event.
  }
}

export const readDiscoverySnapshot = (): DiscoverySnapshot => ({
  discovered: readStored(),
  latest: null,
})

export const markConceptDiscovered = (id: ConceptId) => {
  const before = readStored()
  const alreadyKnown = before.includes(id)
  const discovered = expandDiscoveryWithAncestors([...before, id])
  writeStored(discovered)

  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent<DiscoverySnapshot>(DISCOVERY_EVENT, {
      detail: { discovered, latest: alreadyKnown ? null : id },
    }))
  }
  return !alreadyKnown
}

export const subscribeDiscoveries = (listener: (snapshot: DiscoverySnapshot) => void) => {
  if (typeof window === 'undefined') return () => undefined
  const handler = (event: Event) => {
    const custom = event as CustomEvent<DiscoverySnapshot>
    listener(custom.detail ?? readDiscoverySnapshot())
  }
  window.addEventListener(DISCOVERY_EVENT, handler)
  return () => window.removeEventListener(DISCOVERY_EVENT, handler)
}
