import { useEffect, useMemo, useState } from 'react'
import { conceptLabel, type ConceptId } from './concepts'
import {
  readDiscoverySnapshot,
  subscribeDiscoveries,
  type DiscoverySnapshot,
} from './discoveryState'

const LINEAR_ROUTE: ConceptId[] = [
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

const LINEAR_TAIL = LINEAR_ROUTE.slice(1)

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
  const derivativeKnown = discovered.has('derivative')

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
            className="discovery-map-sheet discovery-map-sheet-v2"
            role="dialog"
            aria-modal="true"
            aria-label="発見した数学世界"
            onPointerDown={(event) => event.stopPropagation()}
          >
            <header>
              <span>DISCOVERED WORLD</span>
              <strong>{snapshot.discovered.length}</strong>
              <button type="button" aria-label="閉じる" onClick={() => setOpen(false)}>×</button>
            </header>

            <div className="discovery-world-root">
              <span className="discovery-node is-known discovery-root-node">{conceptLabel('trig')}</span>
              <i className="discovery-root-stem" aria-hidden="true" />
              <div className="discovery-root-fan" aria-label="単位円から伸びる分岐">
                <span className="discovery-branch-port is-known">{conceptLabel('vector')}</span>
                <span className={`discovery-branch-port ${derivativeKnown ? 'is-known' : 'is-unknown'}`}>
                  {derivativeKnown ? conceptLabel('derivative') : ''}
                </span>
                <span className="discovery-branch-port is-unknown" aria-hidden="true" />
                <span className="discovery-branch-port is-unknown" aria-hidden="true" />
              </div>
            </div>

            <div className="discovery-linear-route discovery-linear-tail" aria-label="発見済みの線形代数ルート">
              {LINEAR_TAIL.map((id, index) => {
                const known = discovered.has(id)
                return (
                  <div className="discovery-route-step" key={id}>
                    <span className={`discovery-node ${known ? 'is-known' : 'is-unknown'}`}>
                      {known ? conceptLabel(id) : ''}
                    </span>
                    {index < LINEAR_TAIL.length - 1 && <i className="discovery-route-edge" aria-hidden="true" />}
                  </div>
                )
              })}
            </div>
          </section>
        </div>
      )}
    </>
  )
}
