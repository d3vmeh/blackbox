// web/src/dashboard/forkBranch.ts
// Derive a synthetic "corrected" branch from the blast-radius nodes + the
// replay result. Pure function — no React, no side effects. The fork branch
// mirrors the blast-radius portion of the graph with corrected labels and
// the injected value on the root-cause node.

import type { Attribution, ReplayResult } from '../types'
import type { ActionGraph, ForkBranch, ForkNode } from './types'

/**
 * Build the corrected fork branch for the split-view visualization.
 *
 * Takes the original graph, the attribution (which tells us the root-cause
 * node and blast radius), and the confirmed replay result. Returns a
 * ForkBranch with synthetic corrected copies of every blast-radius node,
 * starting from the root-cause node and proceeding in graph order.
 *
 * Returns null if the replay didn't flip (no fork to show).
 */
export function deriveForkBranch(
  graph: ActionGraph,
  attribution: Attribution,
  result: ReplayResult,
): ForkBranch | null {
  if (!result.flipped) return null

  const blast = new Set(attribution.blast_radius)

  // Find the root-cause action node
  const rootNode = graph.nodes.find((n) =>
    n.stepIds.includes(attribution.root_step_id),
  )
  if (!rootNode) return null

  // Collect blast-radius action nodes in graph order (the order they appear
  // in graph.nodes is spine order — time-ordered).
  const blastNodes = graph.nodes.filter(
    (n) => n.stepIds.includes(attribution.root_step_id) || n.stepIds.some((s) => blast.has(s)),
  )

  // Build synthetic fork nodes
  const forkNodes: ForkNode[] = blastNodes.map((n) => {
    const isRoot = n.stepIds.includes(attribution.root_step_id)
    return {
      id: `${n.id}-fix`,
      originalId: n.id,
      label: isRoot ? `${n.label} ✓` : `${n.label} ✓`,
      kind: n.kind,
      correctedOutput: isRoot ? result.injected_value : undefined,
    }
  })

  // Sequential edges between fork nodes (top → bottom spine order)
  const edges: { from: string; to: string }[] = []
  for (let i = 0; i < forkNodes.length - 1; i++) {
    edges.push({ from: forkNodes[i].id, to: forkNodes[i + 1].id })
  }

  return {
    originNodeId: rootNode.id,
    nodes: forkNodes,
    edges,
  }
}
