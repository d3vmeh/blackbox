import { agentOf, type AgentId, type Step, type StepKind, type Trace } from '../types'

/**
 * Per-run usage statistics, rolled up per agent and in aggregate. Pure
 * derivation from the recorded Trace — same family as deriveActions /
 * deriveBands / deriveTopology, no React, no schema change.
 *
 * TOKENS ARE ESTIMATED. The Trace contract carries no token field (the backend
 * does not yet stream usage), and web/ is a pure consumer that must not invent
 * backend fields. So token figures are a ~chars/4 proxy over the JSON of each
 * step's inputs (prompt) and output, and every surface that shows them must
 * label them "est.". Swap in real usage here the moment the stream provides it.
 */

const CHARS_PER_TOKEN = 4

/** The closed StepKind set, in pipeline order — keeps the breakdown total + stable. */
const ALL_KINDS: StepKind[] = [
  'reason', 'tool_call', 'tool_result', 'decision', 'handoff', 'final',
]

export interface AgentStats {
  /** owning agent; null = untagged single-agent bucket */
  agentId: AgentId | null
  /** display label (the raw agent id, or 'single' when untagged) */
  label: string
  steps: number
  toolCalls: number
  handoffs: number
  /** ESTIMATED tokens (~chars/4) over consumed inputs */
  tokensIn: number
  /** ESTIMATED tokens (~chars/4) over produced output */
  tokensOut: number
  tokensTotal: number
  /** mean input (prompt) length in characters, rounded */
  avgPromptLen: number
  /** mean output length in characters, rounded */
  avgOutputLen: number
  /** count per StepKind (every key present, zero-filled) */
  kinds: Record<StepKind, number>
}

export interface RunTotals {
  agents: number
  steps: number
  toolCalls: number
  handoffs: number
  tokensIn: number
  tokensOut: number
  tokensTotal: number
  avgPromptLen: number
}

export interface RunStats {
  /** per-agent rows, ordered by first appearance in the trace */
  agents: AgentStats[]
  /** aggregate across every agent */
  totals: RunTotals
}

/** Character length of a value's JSON form (0 for undefined). */
function charsOf(value: unknown): number {
  const json = JSON.stringify(value)
  return json ? json.length : 0
}

/** ~chars/4 token estimate. A proxy only — never presented without an "est." label. */
function estTokens(chars: number): number {
  return Math.round(chars / CHARS_PER_TOKEN)
}

function zeroKinds(): Record<StepKind, number> {
  return ALL_KINDS.reduce(
    (acc, k) => { acc[k] = 0; return acc },
    {} as Record<StepKind, number>,
  )
}

interface Accum {
  agentId: AgentId | null
  steps: Step[]
  promptChars: number
  outputChars: number
}

function summarize(a: Accum): AgentStats {
  const steps = a.steps.length
  const kinds = zeroKinds()
  let toolCalls = 0
  let handoffs = 0
  for (const s of a.steps) {
    kinds[s.kind] += 1
    if (s.kind === 'tool_call') toolCalls += 1
    if (s.kind === 'handoff') handoffs += 1
  }
  const tokensIn = estTokens(a.promptChars)
  const tokensOut = estTokens(a.outputChars)
  return {
    agentId: a.agentId,
    label: a.agentId ?? 'single',
    steps,
    toolCalls,
    handoffs,
    tokensIn,
    tokensOut,
    tokensTotal: tokensIn + tokensOut,
    avgPromptLen: steps > 0 ? Math.round(a.promptChars / steps) : 0,
    avgOutputLen: steps > 0 ? Math.round(a.outputChars / steps) : 0,
    kinds,
  }
}

export function deriveStats(trace: Trace): RunStats {
  // Bucket steps by owning agent, preserving first-appearance order.
  const order: (AgentId | null)[] = []
  const buckets = new Map<AgentId | null, Accum>()

  for (const step of trace.steps) {
    const agentId = agentOf(step)
    let bucket = buckets.get(agentId)
    if (!bucket) {
      bucket = { agentId, steps: [], promptChars: 0, outputChars: 0 }
      buckets.set(agentId, bucket)
      order.push(agentId)
    }
    bucket.steps.push(step)
    bucket.promptChars += charsOf(step.inputs)
    bucket.outputChars += charsOf(step.output)
  }

  const agents = order.map((id) => summarize(buckets.get(id)!))

  const totals: RunTotals = {
    agents: agents.length,
    steps: agents.reduce((n, a) => n + a.steps, 0),
    toolCalls: agents.reduce((n, a) => n + a.toolCalls, 0),
    handoffs: agents.reduce((n, a) => n + a.handoffs, 0),
    tokensIn: agents.reduce((n, a) => n + a.tokensIn, 0),
    tokensOut: agents.reduce((n, a) => n + a.tokensOut, 0),
    tokensTotal: agents.reduce((n, a) => n + a.tokensTotal, 0),
    avgPromptLen: 0,
  }
  totals.avgPromptLen = totals.steps > 0
    ? Math.round(agents.reduce((n, a) => n + a.avgPromptLen * a.steps, 0) / totals.steps)
    : 0

  return { agents, totals }
}
