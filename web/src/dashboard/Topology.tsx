// web/src/dashboard/Topology.tsx
// The agent-wiring DAG that sits atop the spine — the MACRO lens. It lays agents
// out left→right by causal depth (layoutTopology) so the real wiring shows: a
// linear run is one row, a branch fans into rows. It is the only NAVIGABLE view
// of the run — clicking an agent drives the selection that the trace spine below
// reacts to, so the two stop being twins (one is the index, one is the detail).
//
// Color obeys DESIGN.md's closed 3-signal set, applied only via data-status:
//   · root agent node     → --root (owns the localized root cause)
//   · poisoned handoff edge → --blast, LIT from the blast beat onward — THIS is
//     topology's headline: the wire the poison crossed, which the time-ordered
//     trace can't say as cleanly.
//   · everything else stays neutral (--text-dim / --edge)
//
// Agents are differentiated by POSITION + LABEL only — never a per-agent hue.
// Poison tint animates with OPACITY only (transform/opacity rule); under
// prefers-reduced-motion it snaps to its final state with identical colors.
import { motion, useReducedMotion } from 'motion/react'
import type { AgentTopology, NodeStatus } from './types'
import type { AgentId } from '../types'
import type { Phase } from './phase'
import { layoutTopology, NODE_W, NODE_H } from './layoutTopology'
import './Topology.css'

export interface TopologyProps {
  topology: AgentTopology
  phase: Phase
  /** the agent cross-highlighted with the spine (null = none) */
  selectedAgentId?: AgentId | null
  /** click an agent node to drive the trace below */
  onSelectAgent?: (agentId: AgentId) => void
}

/**
 * Has the blast cascade reached the chain yet? Poisoned edges/nodes light from
 * the `blast` beat onward and stay lit through analyze/proving/confirm. In
 * `idle` everything reads neutral (no signal before the cascade runs).
 */
function blastReached(phase: Phase): boolean {
  return phase !== 'idle'
}

const SPRING = { type: 'spring', stiffness: 360, damping: 34, mass: 1 } as const

export function Topology({ topology, phase, selectedAgentId = null, onSelectAgent }: TopologyProps) {
  const reduce = useReducedMotion()
  const lit = blastReached(phase)
  const { nodes, edges, width, height } = layoutTopology(topology)
  const interactive = !!onSelectAgent

  // Node status only carries a signal once the cascade has run; before that the
  // whole strip is neutral so the idle readout stays quiet.
  const nodeStatus = (status: NodeStatus): NodeStatus => (lit ? status : 'neutral')

  return (
    <div className="topo" data-testid="topology">
      <div
        className="topo__canvas"
        style={{ width, height }}
        role="group"
        aria-label="agent wiring diagram"
      >
        <svg className="topo__edges" width={width} height={height} aria-hidden="true">
          {edges.map((edge) => {
            const poisoned = edge.poisoned && lit
            return (
              <g key={`${edge.from}->${edge.to}`} data-testid="topology-edge" data-poisoned={poisoned ? 'true' : 'false'}>
                <path className="topo__edge-line" d={edge.d} fill="none" />
                <motion.path
                  className="topo__edge-poison"
                  d={edge.d}
                  fill="none"
                  initial={false}
                  animate={{ opacity: poisoned ? 1 : 0 }}
                  transition={reduce ? { duration: 0 } : SPRING}
                >
                  <title>{`${edge.from} → ${edge.to}${poisoned ? ' · poison crossed here' : ' · handoff'}`}</title>
                </motion.path>
              </g>
            )
          })}
        </svg>
        {nodes.map((node) => {
          const selected = selectedAgentId === node.id
          const dimmed = selectedAgentId != null && !selected
          return (
            <button
              key={node.id}
              type="button"
              className="topo__node"
              data-status={nodeStatus(node.status)}
              data-selected={selected ? 'true' : undefined}
              data-dimmed={dimmed ? 'true' : undefined}
              data-testid="topology-node"
              disabled={!interactive}
              title={node.label}
              onClick={() => onSelectAgent?.(node.id)}
              style={{ left: node.x, top: node.y, width: NODE_W, height: NODE_H }}
            >
              {node.label}
            </button>
          )
        })}
      </div>
    </div>
  )
}
