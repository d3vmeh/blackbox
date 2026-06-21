// web/src/dashboard/Topology.tsx
// The compact horizontal agent-wiring DAG strip that sits atop the spine panel.
// Renders one node per agent (left→right, first-seen order) with handoff edges
// between them. Quiet by default; the three reserved signals are the only color:
//   · root  agent node → --root (the agent that owns the localized root cause)
//   · blast agent node → --blast (an agent on the poisoned forward slice)
//   · poisoned handoff edge → --blast, LIT in sync with the blast phase
//   · everything else stays neutral (--text-dim / --edge)
//
// Agents are differentiated by POSITION + LABEL only — never a per-agent hue.
// Edge poison-tint animates with OPACITY only (transform/opacity rule); under
// prefers-reduced-motion it snaps to its final state with identical colors.
//
// Consumes deriveTopology() output verbatim — it does NOT recompute topology.
import { motion, useReducedMotion } from 'motion/react'
import type { AgentTopology, NodeStatus } from './types'
import type { Phase } from './phase'
import './Topology.css'

export interface TopologyProps {
  topology: AgentTopology
  phase: Phase
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

export function Topology({ topology, phase }: TopologyProps) {
  const reduce = useReducedMotion()
  const lit = blastReached(phase)
  const { agents, handoffs } = topology

  // Node status only carries a signal once the cascade has run; before that the
  // whole strip is neutral so the idle readout stays quiet.
  const nodeStatus = (status: NodeStatus): NodeStatus => (lit ? status : 'neutral')

  return (
    <div className="topo" data-testid="topology" role="img" aria-label="agent wiring diagram">
      <ol className="topo__row">
        {agents.map((agent, i) => {
          // Is there a handoff between this agent and the next one in the row?
          const next = agents[i + 1]
          const edge =
            next &&
            handoffs.find(
              (h) =>
                (h.from === agent.id && h.to === next.id) ||
                (h.from === next.id && h.to === agent.id),
            )
          const edgePoisoned = !!edge?.poisoned && lit

          return (
            <li className="topo__cell" key={agent.id}>
              <span
                className="topo__node"
                data-status={nodeStatus(agent.status)}
                data-testid="topology-node"
                title={agent.label}
              >
                {agent.label}
              </span>
              {next && (
                <span
                  className="topo__edge"
                  data-testid="topology-edge"
                  data-has-handoff={edge ? 'true' : 'false'}
                  data-poisoned={edgePoisoned ? 'true' : 'false'}
                  aria-hidden="true"
                >
                  <span className="topo__edge-line" />
                  <motion.span
                    className="topo__edge-poison"
                    initial={false}
                    animate={{ opacity: edgePoisoned ? 1 : 0 }}
                    transition={reduce ? { duration: 0 } : SPRING}
                  />
                </span>
              )}
            </li>
          )
        })}
      </ol>
    </div>
  )
}
