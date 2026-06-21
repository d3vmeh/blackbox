// web/src/dashboard/graph/TraceGraph.tsx
// The trace as a node-link graph: time-ordered nodes stacked top→down, offset by
// lane (reason · tool · parallel), with curved SVG connectors between them.
// Ordinary nodes recede; only the root cause and its blast cascade carry a signal
// hue (left-edge bar + colored label on nodes; poison-tinted edges). The analyze
// beat ignites --ring-root on the root; confirm shows the fork branch.
//
// Fork-aware: when a ForkBranch is present (confirmed replay), a second column of
// corrected nodes appears to the right with staggered animation. The original blast
// nodes dim to recede, making the green fork branch the visual focus.
import { motion, useReducedMotion } from 'motion/react'
import type { ActionGraph, ForkBranch } from '../types'
import type { StatusMap } from '../nodeStatus'
import { layout, FORK_NODE_W, NODE_H } from '../layout'
import { displayStatus, type Phase } from '../phase'
import { GraphNode } from './GraphNode'
import { ForkGraphNode } from './ForkGraphNode'
import '../dashboard.css'

export function TraceGraph({ graph, status, phase, selectedId, onSelect, forkBranch }: {
  graph: ActionGraph
  status: StatusMap
  phase: Phase
  selectedId: string | null
  onSelect: (id: string) => void
  forkBranch?: ForkBranch | null
}) {
  const reduce = useReducedMotion()
  const l = layout(graph, status, forkBranch)
  const posById = new Map(l.positions.map((p) => [p.id, p]))
  const hasFork = forkBranch && l.forkPositions.length > 0

  // Set of original node IDs that have a fork counterpart (for dimming).
  const forkedOriginals = new Set(forkBranch?.nodes.map((n) => n.originalId) ?? [])

  return (
    <div className="tg" style={{ width: l.width, height: l.height }}>
      <svg className="tg__edges" width={l.width} height={l.height} viewBox={`0 0 ${l.width} ${l.height}`}>
        {/* Original edges */}
        {l.edges.map((e) => {
          const dash = e.poison
            ? (e.longHop ? '4 4' : undefined)
            : e.crossAgent
              ? '5 4'
              : e.longHop ? '4 4' : undefined
          const opacity = e.poison
            ? (hasFork ? 0.45 : 0.85)
            : e.crossAgent ? 0.62 : 0.5
          return (
            <path
              key={`${e.from}-${e.to}`}
              d={e.d}
              fill="none"
              stroke={e.poison ? 'var(--blast)' : 'var(--edge)'}
              strokeWidth={e.poison ? 1.6 : 1}
              strokeDasharray={dash}
              opacity={hasFork ? opacity * 0.6 : opacity}
              data-cross={!e.poison && e.crossAgent ? 'true' : undefined}
            />
          )
        })}
        {/* Fork edges (dashed --pass) */}
        {l.forkEdges.map((e) => (
          <motion.path
            key={`fork-${e.from}-${e.to}`}
            d={e.d}
            fill="none"
            stroke="var(--pass)"
            strokeWidth={1.6}
            strokeDasharray="6 4"
            initial={reduce ? false : { pathLength: 0, opacity: 0 }}
            animate={{ pathLength: 1, opacity: 0.85 }}
            transition={reduce ? { duration: 0 } : { duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
          />
        ))}
      </svg>

      {/* Band separators */}
      {l.separators.map((s, i) => (
        <div key={`sep-${i}`} className="tg__band-sep" style={{ top: s.y, width: l.width }} />
      ))}

      {/* Band labels */}
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

      {/* Fork column label */}
      {hasFork && (
        <motion.span
          className="tg__fork-column-label"
          style={{ left: l.forkX, top: l.forkPositions[0]?.y - 22 }}
          initial={reduce ? false : { opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={reduce ? { duration: 0 } : { delay: 0.2, duration: 0.4 }}
        >
          CORRECTED
        </motion.span>
      )}

      {/* Original nodes */}
      {graph.nodes.map((n, i) => {
        const p = posById.get(n.id)!
        const st = displayStatus(status[n.id] ?? 'neutral', phase)
        const dimmed = hasFork && forkedOriginals.has(n.id)
        return (
          <motion.div
            key={n.id}
            style={{ position: 'absolute', left: p.x, top: p.y }}
            initial={reduce ? false : { opacity: 0.6, scale: 0.98 }}
            animate={{
              opacity: dimmed ? 0.45 : 1,
              scale: st === 'blast' && !hasFork ? [1, 1.06, 1] : 1,
            }}
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

      {/* Fork branch nodes (staggered animation) */}
      {hasFork && forkBranch!.nodes.map((fn, i) => {
        const fp = l.forkPositions.find((p) => p.id === fn.id)
        if (!fp) return null
        return (
          <motion.div
            key={fn.id}
            style={{ position: 'absolute', left: fp.x, top: fp.y }}
            initial={reduce ? false : { opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={reduce
              ? { duration: 0 }
              : { delay: 0.15 + i * 0.08, duration: 0.35, ease: [0.16, 1, 0.3, 1] }
            }
          >
            <ForkGraphNode
              node={fn}
              style={{ position: 'static', width: FORK_NODE_W, minHeight: NODE_H }}
            />
          </motion.div>
        )
      })}
    </div>
  )
}
