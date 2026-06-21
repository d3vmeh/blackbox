import type { Step, Trace } from '../types'
import type { ActionEdge, ActionGraph, ActionNode, Lane } from './types'

const PARALLEL_TOOLS = new Set(['browser_navigate'])

function laneFor(step: Step): Lane {
  if (step.kind === 'tool_call' || step.kind === 'tool_result') {
    return step.tool_name && PARALLEL_TOOLS.has(step.tool_name) ? 'parallel' : 'tool'
  }
  return 'reason'
}

function labelFor(step: Step): string {
  const display = step.raw?.display
  if (typeof display === 'string') return display
  const agent = step.raw?.agent
  if (typeof agent === 'string') return agent.toUpperCase()
  if (step.tool_name) return step.tool_name
  const out = typeof step.output === 'string' ? step.output : ''
  return out.length > 48 ? `${out.slice(0, 47)}…` : out || step.kind
}

export function deriveActions(trace: Trace): ActionGraph {
  const nodes: ActionNode[] = []
  const stepToNode = new Map<string, string>() // Step.id -> action id
  const steps = trace.steps

  for (let i = 0; i < steps.length; i++) {
    const step = steps[i]
    const prev = steps[i - 1]
    // Skip tool_result only when it pairs with the immediately preceding tool_call.
    if (
      step.kind === 'tool_result' &&
      prev?.kind === 'tool_call' &&
      prev.tool_name === step.tool_name
    ) {
      continue
    }
    const id = `a${nodes.length}`
    const stepIds = [step.id]
    const next = steps[i + 1]
    if (
      step.kind === 'tool_call' &&
      next?.kind === 'tool_result' &&
      next.tool_name === step.tool_name
    ) {
      stepIds.push(next.id)
      stepToNode.set(next.id, id)
    }
    stepToNode.set(step.id, id)
    nodes.push({ id, stepIds, kind: step.kind, label: labelFor(step), lane: laneFor(step) })
  }

  const seq = new Map(nodes.map((n, idx) => [n.id, idx]))
  const edgeKeys = new Set<string>()
  const edges: ActionEdge[] = []
  for (const step of steps) {
    const to = stepToNode.get(step.id)
    if (!to) continue
    for (const p of step.parents) {
      const from = stepToNode.get(p)
      if (!from || from === to) continue
      const key = `${from}->${to}`
      if (edgeKeys.has(key)) continue
      edgeKeys.add(key)
      edges.push({ from, to, longHop: Math.abs((seq.get(from) ?? 0) - (seq.get(to) ?? 0)) > 1 })
    }
  }
  return { nodes, edges }
}
