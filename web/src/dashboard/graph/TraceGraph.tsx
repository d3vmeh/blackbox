// web/src/dashboard/graph/TraceGraph.tsx
// The trace as a node-link graph: time-ordered nodes stacked top→down, offset by
// lane (reason · tool · parallel), with curved SVG connectors between them.
// Ordinary nodes recede; only the root cause and its blast cascade carry a signal
// hue (left-edge bar + colored label on nodes; poison-tinted edges). The analyze
// beat ignites --ring-root on the root; confirm heals blast→pass. (see DESIGN.md)
import { motion, useReducedMotion } from 'motion/react'
import type { ActionGraph } from '../types'
import type { StatusMap } from '../nodeStatus'
import { layout } from '../layout'
import { displayStatus, type Phase } from '../phase'
import { GraphNode } from './GraphNode'
import '../dashboard.css'

export function TraceGraph({ graph, status, phase, selectedId, onSelect }: {
  graph: ActionGraph
  status: StatusMap
  phase: Phase
  selectedId: string | null
  onSelect: (id: string) => void
}) {
  const reduce = useReducedMotion()
  const l = layout(graph, status)
  const posById = new Map(l.positions.map((p) => [p.id, p]))
  return (
    <div className="tg" style={{ width: l.width, height: l.height }}>
      <svg className="tg__edges" width={l.width} height={l.height} viewBox={`0 0 ${l.width} ${l.height}`}>
        {l.edges.map((e) => {
          // Poison wins over the cross-agent dash so the blast cascade reads
          // identically. Non-poison cross-agent edges become a dashed handoff
          // wire (neutral --edge, slightly higher opacity); intra-agent edges
          // keep the existing solid / longHop-dash behavior.
          const dash = e.poison
            ? (e.longHop ? '4 4' : undefined)
            : e.crossAgent
              ? '5 4'
              : e.longHop ? '4 4' : undefined
          const opacity = e.poison ? 0.55 : e.crossAgent ? 0.62 : 0.5
          return (
            <path
              key={`${e.from}-${e.to}`}
              d={e.d}
              fill="none"
              stroke={e.poison ? 'color-mix(in srgb, var(--blast) 60%, var(--edge))' : 'var(--edge)'}
              strokeWidth={e.poison ? 1.3 : 1}
              strokeDasharray={dash}
              opacity={opacity}
              data-cross={!e.poison && e.crossAgent ? 'true' : undefined}
            />
          )
        })}
      </svg>
      {l.separators.map((s, i) => (
        <div key={`sep-${i}`} className="tg__band-sep" style={{ top: s.y, width: l.width }} />
      ))}
      {l.bands.map((band, i) => (
        <span
          key={`band-${band.agentId}-${i}`}
          className="tg__band-label"
          data-root={band.isRoot}
          style={{ top: (band.top + band.bottom) / 2 }}
        >
          {band.label}
        </span>
      ))}
      {graph.nodes.map((n, i) => {
        const p = posById.get(n.id)!
        const st = displayStatus(status[n.id] ?? 'neutral', phase)
        return (
          <motion.div
            key={n.id}
            style={{ position: 'absolute', left: p.x, top: p.y }}
            initial={reduce ? false : { opacity: 0.6, scale: 0.98 }}
            animate={{ opacity: 1, scale: st === 'blast' ? [1, 1.06, 1] : 1 }}
            transition={reduce ? { duration: 0 } : { delay: i * 0.06, duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
          >
            <GraphNode
              node={n}
              status={st}
              selected={selectedId === n.id}
              onSelect={onSelect}
              style={{ position: 'static' }}
            />
          </motion.div>
        )
      })}
    </div>
  )
}
