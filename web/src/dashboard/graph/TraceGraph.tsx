// web/src/dashboard/graph/TraceGraph.tsx
// The trace is the spine: a single vertical chain, top→down, ordinary steps recede,
// the root cause and its blast cascade are the only colored signals. (see DESIGN.md)
// Each step is a node sitting on the thread; status reads through its dot + (for the
// root) a tinted left edge — color stays rare so the failure path is unmistakable.
import { useReducedMotion } from 'motion/react'
import type { ActionGraph, ActionNode, NodeStatus } from '../types'
import type { StatusMap } from '../nodeStatus'
import { displayStatus, type Phase } from '../phase'
import '../dashboard.css'

const KIND_TAG: Record<ActionNode['kind'], string> = {
  reason: 'RSN', tool_call: 'TOOL', tool_result: 'TOOL', decision: 'DEC', final: 'FIN',
}

// Only the root is labelled; blast/pass speak through their colored dot, keeping the
// chain calm (color is rare). The verdict flip carries the heal moment.
const MARKER: Partial<Record<NodeStatus, string>> = {
  root: 'ROOT CAUSE',
}

const STAGGER_S = 0.06 // per-step poison cascade (mirrors --stagger-blast)

export function TraceGraph({ graph, status, phase, selectedId, onSelect }: {
  graph: ActionGraph
  status: StatusMap
  phase: Phase
  selectedId: string | null
  onSelect: (id: string) => void
}) {
  const reduce = useReducedMotion()
  const rootIndex = graph.nodes.findIndex((n) => status[n.id] === 'root')
  // Blast spreads forward from the root; confirm heals along the same path.
  const cascading = phase === 'blast' || phase === 'confirm'

  return (
    <ol className={`tg${phase === 'analyze' ? ' tg--analyzing' : ''}`}>
      {graph.nodes.map((n, i) => {
        const st = displayStatus(status[n.id] ?? 'neutral', phase)
        const delay = !reduce && cascading && rootIndex >= 0 && i >= rootIndex
          ? `${(i - rootIndex) * STAGGER_S}s`
          : '0s'
        return (
          <li key={n.id} className="tg__li">
            <button
              type="button"
              data-testid={`node-${n.id}`}
              data-status={st}
              data-selected={selectedId === n.id}
              className="tg__node"
              onClick={() => onSelect(n.id)}
            >
              <span className="tg__dot" style={{ transitionDelay: delay }} aria-hidden="true" />
              <span className="tg__idx">{String(i).padStart(2, '0')}</span>
              <span className="tg__kind">{KIND_TAG[n.kind]}</span>
              <span className="tg__label">{n.label}</span>
              <span className="tg__marker" style={{ transitionDelay: delay }}>{MARKER[st] ?? ''}</span>
            </button>
          </li>
        )
      })}
    </ol>
  )
}
