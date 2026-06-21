// web/src/dashboard/graph/TraceGraph.tsx
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
      {graph.nodes.map((n) => {
        const p = posById.get(n.id)!
        return (
          <GraphNode
            key={n.id}
            node={n}
            status={displayStatus(status[n.id] ?? 'neutral', phase)}
            selected={selectedId === n.id}
            onSelect={onSelect}
            style={{ left: p.x, top: p.y }}
          />
        )
      })}
    </div>
  )
}
