import { motion, useReducedMotion } from 'motion/react'
import { useState } from 'react'
import { SYSTEM_MAP_NODES, type SystemMapNodeId } from './narrative'

/** Explorable capability map — hover nodes to trace relationships. */
export function SystemMap() {
  const [hovered, setHovered] = useState<SystemMapNodeId | null>(null)
  const reduce = useReducedMotion()
  const active = hovered ?? 'root'

  const activeNode = SYSTEM_MAP_NODES.find((n) => n.id === active)!
  const hoveredNode = hovered ? SYSTEM_MAP_NODES.find((n) => n.id === hovered) : null

  const edgeKey = (a: string, b: string) => (a < b ? `${a}-${b}` : `${b}-${a}`)
  const drawnEdges = new Set<string>()

  const nodeLit = (n: (typeof SYSTEM_MAP_NODES)[number]) => {
    if (active === n.id) return true
    if (!hovered) return active === n.id
    if ((n.links as readonly string[]).includes(hovered)) return true
    if ((hoveredNode?.links as readonly string[] | undefined)?.includes(n.id)) return true
    return false
  }

  return (
    <section className="system-map" id="system-map" aria-label="System map">
      <p className="eyebrow sect__eyebrow">System map</p>
      <h2 className="sect__title system-map__title">Explore how the pieces connect</h2>
      <p className="sect__lead system-map__lead">
        Hover nodes to trace relationships across the investigation pipeline.
      </p>

      <div className="system-map__stage">
        <div className="system-map__canvas">
          <div className="system-map__plot">
            <svg className="system-map__links" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
              {SYSTEM_MAP_NODES.flatMap((n) =>
                n.links.map((targetId) => {
                  const target = SYSTEM_MAP_NODES.find((t) => t.id === targetId)
                  if (!target) return null
                  const key = edgeKey(n.id, targetId)
                  if (drawnEdges.has(key)) return null
                  drawnEdges.add(key)
                  const lit = hovered === n.id || hovered === targetId
                  return (
                    <motion.line
                      key={key}
                      x1={n.x}
                      y1={n.y}
                      x2={target.x}
                      y2={target.y}
                      stroke={lit ? 'var(--text-dim)' : 'var(--line)'}
                      strokeWidth={lit ? 0.55 : 0.35}
                      vectorEffect="non-scaling-stroke"
                      initial={false}
                      animate={{ opacity: lit ? 0.9 : 0.4 }}
                      transition={{ duration: reduce ? 0 : 0.25 }}
                    />
                  )
                }),
              )}
            </svg>

            {SYSTEM_MAP_NODES.map((n) => {
              const lit = nodeLit(n)
              return (
                <motion.button
                  key={n.id}
                  type="button"
                  className={`system-map__node system-map__node--${n.id}${lit ? ' system-map__node--lit' : ''}`}
                  style={{ left: `${n.x}%`, top: `${n.y}%` }}
                  onMouseEnter={() => setHovered(n.id)}
                  onMouseLeave={() => setHovered(null)}
                  onFocus={() => setHovered(n.id)}
                  onBlur={() => setHovered(null)}
                  aria-pressed={active === n.id}
                >
                  <span className="system-map__node-label">{n.label}</span>
                  {lit && !reduce && (
                    <motion.span
                      className="system-map__node-ring"
                      layoutId={`ring-${n.id}`}
                      initial={{ scale: 0.8, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      transition={{ type: 'spring', stiffness: 400, damping: 28 }}
                    />
                  )}
                </motion.button>
              )
            })}
          </div>
        </div>

        <motion.div
          className="system-map__detail"
          key={activeNode.id}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ type: 'spring', stiffness: 320, damping: 30 }}
        >
          <span className="system-map__detail-label eyebrow">{activeNode.label}</span>
          <p className="system-map__detail-body">{activeNode.desc}</p>
          <div className="system-map__detail-links">
            {activeNode.links.map((l) => {
              const ln = SYSTEM_MAP_NODES.find((n) => n.id === l)
              return ln ? (
                <span key={l} className="system-map__chip">{ln.label}</span>
              ) : null
            })}
          </div>
        </motion.div>
      </div>
    </section>
  )
}
