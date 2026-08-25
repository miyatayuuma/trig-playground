import { useEffect, useMemo, useState } from 'react'
import { conceptLabel, type ConceptId } from './concepts'
import {
  readDiscoverySnapshot,
  subscribeDiscoveries,
  type DiscoverySnapshot,
} from './discoveryState'

const LINEAR_ROUTE: ConceptId[] = [
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
]

const BRANCH_STUBS = [3, 2, 3]

export default function DiscoveryMapPortal() {
  const [snapshot, setSnapshot] = useState<DiscoverySnapshot>(() => readDiscoverySnapshot())
  const [open, setOpen] = useState(false)
  const [reaction, setReaction] = useState<ConceptId | null>(null)

  useEffect(() => subscribeDiscoveries((next) => {
    setSnapshot(next)
    if (next.latest) setReaction(next.latest)
  }), [])

  useEffect(() => {
    if (!reaction) return undefined
    const timer = window.setTimeout(() => setReaction(null), 1150)
    return () => window.clearTimeout(timer)
  }, [reaction])

  useEffect(() => {
    if (!open) return undefined
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false)
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [open])

  const discovered = useMemo(() => new Set(snapshot.discovered), [snapshot.discovered])
  const visibleCount = LINEAR_ROUTE.filter((id) => discovered.has(id)).length
  const showMapButton = visibleCount >= 4

  return (
    <>
      {reaction && (
        <div className="discovery-reaction" role="status" aria-live="polite">
          <span>DISCOVERED</span>
          <strong>{conceptLabel(reaction)}</strong>
        </div>
      )}

      {showMapButton && (
        <button
          type="button"
          className="discovery-map-button"
          aria-label="発見した数学世界を見る"
          aria-expanded={open}
          onClick={() => setOpen((current) => !current)}
        >
          <span className="discovery-map-icon" aria-hidden="true">
            <i />
            <i />
            <i />
          </span>
        </button>
      )}

      {open && (
        <div className="discovery-map-backdrop" role="presentation" onPointerDown={() => setOpen(false)}>
          <section
            className="discovery-map-sheet"
            role="dialog"
            aria-modal="true"
            aria-label="発見した数学世界"
            onPointerDown={(event) => event.stopPropagation()}
          >
            <header>
              <span>DISCOVERED PATH</span>
              <strong>{snapshot.discovered.length}</strong>
              <button type="button" aria-label="閉じる" onClick={() => setOpen(false)}>×</button>
            </header>

            <div className="discovery-linear-route" aria-label="線形代数ルート">
              {LINEAR_ROUTE.map((id, index) => {
                const known = discovered.has(id)
                return (
                  <div className="discovery-route-step" key={id}>
                    <span className={`discovery-node ${known ? 'is-known' : 'is-unknown'}`}>
                      {known ? conceptLabel(id) : ''}
                    </span>
                    {index < LINEAR_ROUTE.length - 1 && <i className="discovery-route-edge" aria-hidden="true" />}
                  </div>
                )
              })}
            </div>

            <div className="discovery-branch-stubs" aria-label="未発見の分岐">
              {BRANCH_STUBS.map((count, branchIndex) => (
                <div className="discovery-branch" key={branchIndex} aria-hidden="true">
                  {Array.from({ length: count }, (_, index) => (
                    <span key={index} className="discovery-unknown-dot" />
                  ))}
                </div>
              ))}
            </div>
          </section>
        </div>
      )}
    </>
  )
}
