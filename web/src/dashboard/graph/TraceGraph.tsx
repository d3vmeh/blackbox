// web/src/dashboard/graph/TraceGraph.tsx
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
        {l.edges.map((e) => (
          <path
            key={`${e.from}-${e.to}`}
            d={e.d}
            fill="none"
            stroke={e.poison ? 'var(--blast)' : '#283039'}
            strokeWidth={e.poison ? 1.6 : 1}
            strokeDasharray={e.longHop ? '4 4' : undefined}
            opacity={e.poison ? 0.85 : 0.5}
          />
        ))}
      </svg>
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
