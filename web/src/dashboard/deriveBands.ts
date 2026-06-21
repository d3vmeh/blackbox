import type { AgentId } from '../types'
import type { ActionGraph, AgentBand } from './types'

/**
 * Group consecutive ActionNodes (in time order) by `agentId` into contiguous
 * AgentBands — the spine's per-agent row groups. A run of nodes with the same
 * agent is one band; the moment the agent changes (or a handoff hands off to a
 * different agent) a new band starts, even if that agent reappears later. So a
 * pipeline like extractor → matcher → fraud → matcher yields four bands, with
 * `matcher` appearing twice — bands are contiguous, never merged across a gap.
 *
 * Parallel detection: within a band, sibling nodes that fan out from the same
 * parent node and have no edge ordering between them run at the same time index
 * (e.g. MATCHER∥FRAUD when they live in one band). Those sets are recorded in
 * `parallelGroupIds` so the renderer can lay them out as adjacent rows. A purely
 * sequential band has no `parallelGroupIds`.
 *
 * Pure function — no React, no time_index lookup (time order is the node order).
 */

/** Short mono UPPERCASE band labels for known agents; fallback = first 5 chars. */
const LABELS: Record<string, string> = {
  extractor: 'EXTR',
  matcher: 'MATCH',
  fraud: 'FRAUD',
  approver: 'APPR',
  payment: 'PAY',
}

function labelFor(agentId: AgentId | null): string {
  if (!agentId) return 'AGENT'
  const known = LABELS[agentId]
  if (known) return known
  return agentId.slice(0, 5).toUpperCase()
}

/**
 * Find parallel groups inside a band: sibling node ids that share at least one
 * common parent (within the band) and have no ordering edge between them. Each
 * returned group has ≥2 members.
 */
function parallelGroupsIn(band: string[], graph: ActionGraph): string[][] {
  const inBand = new Set(band)
  // parents (restricted to nodes in this band) for each band node
  const parents = new Map<string, Set<string>>()
  // direct edge adjacency within the band (either direction) → ordered, not parallel
  const ordered = new Set<string>() // key `${a}|${b}` with a < b lexically not needed; store both
  for (const id of band) parents.set(id, new Set())
  for (const e of graph.edges) {
    if (!inBand.has(e.from) || !inBand.has(e.to)) continue
    parents.get(e.to)?.add(e.from)
    ordered.add(`${e.from}->${e.to}`)
    ordered.add(`${e.to}->${e.from}`)
  }

  // Group band nodes by their (sorted) parent signature; siblings share a parent.
  const byParent = new Map<string, string[]>()
  for (const id of band) {
    const ps = parents.get(id)
    if (!ps || ps.size === 0) continue
    for (const p of ps) {
      const arr = byParent.get(p) ?? []
      arr.push(id)
      byParent.set(p, arr)
    }
  }

  const groups: string[][] = []
  const seen = new Set<string>()
  for (const siblings of byParent.values()) {
    // keep only siblings with no ordering edge between any pair
    if (siblings.length < 2) continue
    const independent = siblings.filter((a) =>
      siblings.every((b) => a === b || !ordered.has(`${a}->${b}`)),
    )
    if (independent.length < 2) continue
    const key = independent.join(',')
    if (seen.has(key)) continue
    seen.add(key)
    groups.push(independent)
  }
  return groups
}

export function deriveBands(graph: ActionGraph): AgentBand[] {
  const runs: { agentId: AgentId; nodeIds: string[] }[] = []
  let current: { agentId: AgentId; nodeIds: string[] } | null = null

  for (const node of graph.nodes) {
    const agentId: AgentId = node.agentId ?? 'agent'
    if (current && current.agentId === agentId) {
      current.nodeIds.push(node.id)
    } else {
      current = { agentId, nodeIds: [node.id] }
      runs.push(current)
    }
  }

  return runs.map((run) => {
    const groups = parallelGroupsIn(run.nodeIds, graph)
    const band: AgentBand = {
      agentId: run.agentId,
      label: labelFor(run.agentId),
      nodeIds: run.nodeIds,
    }
    if (groups.length > 0) band.parallelGroupIds = groups
    return band
  })
}
