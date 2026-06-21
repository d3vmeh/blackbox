// web/src/dashboard/graph/TraceGraph.tsx
// The trace as a node-link graph: time-ordered nodes stacked top→down, offset by
// lane (reason · tool · parallel), with curved SVG connectors between them.
// Ordinary nodes recede; only the root cause and its blast cascade carry a signal
// hue (left-edge bar + colored label on nodes; poison-tinted edges). The analyze
// beat ignites --ring-root on the root; confirm heals blast→pass. (see DESIGN.md)
import { useEffect, useRef, useState } from 'react'
import { motion, useReducedMotion } from 'motion/react'
import type { ActionGraph } from '../types'
import type { NodeStatus } from '../types'
import type { StatusMap } from '../nodeStatus'
import { layout } from '../layout'
import { displayStatus, type Phase } from '../phase'
import { GraphNode } from './GraphNode'
import '../dashboard.css'

// How long between each blast node turning red (ms).
const BLAST_STAGGER = 1300
// How long between each node starting to heal (ms).
// CSS plays the scan animation automatically when data-status flips to 'pass'.
const HEAL_STAGGER = 1900

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

  // Per-node status overrides driven by staggered timeouts.
  const [staggeredStatus, setStaggeredStatus] = useState<Map<string, NodeStatus>>(new Map())
  const timersRef = useRef<ReturnType<typeof setTimeout>[]>([])

  // Refs let the effect read current props without adding them to deps —
  // prevents a parent re-render from re-running the effect mid-cascade.
  const nodesRef = useRef(graph.nodes)
  const statusRef = useRef(status)
  nodesRef.current = graph.nodes
  statusRef.current = status

  useEffect(() => {
    timersRef.current.forEach(clearTimeout)
    timersRef.current = []

    if (phase === 'idle') {
      setStaggeredStatus(new Map())
      return
    }

    const nodes = nodesRef.current
    const s = statusRef.current

    if (phase === 'blast' && !reduce) {
      // Reveal blast nodes one by one (root is already shown via displayStatus).
      const blastNodes = nodes.filter((n) => (s[n.id] ?? 'neutral') === 'blast')
      blastNodes.forEach((node, idx) => {
        timersRef.current.push(
          setTimeout(() => {
            setStaggeredStatus((prev) => new Map(prev).set(node.id, 'blast'))
          }, idx * BLAST_STAGGER),
        )
      })
      return
    }

    if (phase === 'confirm' && !reduce) {
      // Heal: root first, then blast nodes in graph order.
      // One timer per node — CSS plays the scan animation when data-status flips to 'pass'.
      const rootNode = nodes.find((n) => (s[n.id] ?? 'neutral') === 'root')
      const blastNodes = nodes.filter((n) => (s[n.id] ?? 'neutral') === 'blast')
      const healOrder = [rootNode, ...blastNodes].filter(Boolean) as typeof nodes

      healOrder.forEach((node, idx) => {
        timersRef.current.push(
          setTimeout(() => {
            setStaggeredStatus((prev) => new Map(prev).set(node.id, 'pass'))
          }, idx * HEAL_STAGGER),
        )
      })
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, reduce])

  // Derive each node's effective display status, respecting the stagger overrides.
  function effectiveStatus(nodeId: string): NodeStatus {
    if (reduce) return displayStatus(status[nodeId] ?? 'neutral', phase)

    const override = staggeredStatus.get(nodeId)
    if (override) return override

    const base = status[nodeId] ?? 'neutral'

    // During blast/analyze: unrevealed blast nodes stay neutral until their timeout fires.
    if ((phase === 'blast' || phase === 'analyze') && base === 'blast') return 'neutral'

    // During confirm: nodes not yet healed stay at blast (not jumping to pass early).
    if ((phase === 'confirm' || phase === 'proving_root' || phase === 'proving_decoy') &&
        (base === 'blast' || base === 'root')) return base

    return displayStatus(base, phase)
  }

  return (
    <div className="tg" style={{ width: l.width, height: l.height }}>
      <svg className="tg__edges" width={l.width} height={l.height} viewBox={`0 0 ${l.width} ${l.height}`}>
        {l.edges.map((e) => {
          const dash = e.poison
            ? (e.longHop ? '4 4' : undefined)
            : e.crossAgent
              ? '5 4'
              : e.longHop ? '4 4' : undefined
          // Edge heals to --pass when its source node has healed (fix propagates forward).
          const fromHealed = e.poison && effectiveStatus(e.from) === 'pass'
          const edgeStroke = e.poison
            ? (fromHealed ? 'var(--pass)' : 'var(--blast)')
            : 'var(--edge)'
          const opacity = e.poison ? 0.85 : e.crossAgent ? 0.62 : 0.5
          return (
            <path
              key={`${e.from}-${e.to}`}
              d={e.d}
              fill="none"
              stroke={edgeStroke}
              strokeWidth={e.poison ? 1.6 : 1}
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
        const st = effectiveStatus(n.id)
        return (
          <motion.div
            key={n.id}
            style={{ position: 'absolute', left: p.x, top: p.y }}
            initial={reduce ? false : { opacity: 0.6, scale: 0.98 }}
            animate={{
              opacity: 1,
              scale: st === 'blast' ? [1, 1.14, 1] : st === 'pass' ? [1, 1.07, 1] : 1,
            }}
            transition={reduce ? { duration: 0 } : {
              delay: i * 0.04,
              duration: st === 'blast' ? 0.45 : st === 'pass' ? 0.38 : 0.22,
              ease: [0.16, 1, 0.30, 1],
            }}
          >
            <GraphNode
              key={st === 'pass' ? `${n.id}-healed` : n.id}
              node={n}
              status={st}
              selected={selectedId === n.id}
              onSelect={onSelect}
              style={{ position: 'relative' }}
            />
          </motion.div>
        )
      })}
    </div>
  )
}
