/**
 * Frontend mirror of the canonical backend contracts in `shared/schema.py`.
 *
 * KEEP IN SYNC: these types map 1:1 to the Pydantic models. If a field name
 * changes in `shared/schema.py`, change it here too (and notify the backend
 * workstream). The five types map to the pipeline:
 *
 *   Trace        -> what the agent did (recorded)
 *   Candidate    -> a ranked suspect step (localized)
 *   Attribution  -> root cause + blast radius (localized + sliced)
 *   ReplayResult -> intervention outcome (confirmed or rejected)
 *   MonitorDecision -> trust gate (auto_apply or escalate)
 */

/** Any JSON-serializable value. Mirrors Pydantic `Any` over the wire without `any`. */
export type Json =
  | string
  | number
  | boolean
  | null
  | Json[]
  | { [key: string]: Json }

/** `Step.kind` — the role a step plays in the run. */
export type StepKind =
  | 'reason'
  | 'tool_call'
  | 'tool_result'
  | 'decision'
  | 'final'
  // A pass-through carrier step that moves a payload from one agent to the next.
  // Its `output` IS the handoff payload; its `parents` are the producing steps.
  // A handoff is NOT judged — it is plumbing, never a root cause.
  | 'handoff'

/**
 * Identifier for the agent that emitted a step in a multi-agent run.
 * Domain-agnostic on purpose: any pipeline (Accounts-Payable, support triage,
 * code agents, …) can tag its steps; the dashboard never hardcodes a closed set.
 */
export type AgentId = string

/**
 * Read the owning agent of a step from its raw span payload (`raw['agent']`).
 * Returns the id only when present and a string; otherwise null (single-agent /
 * untagged trace). Agents are differentiated by POSITION + LABEL, never a hue.
 */
export function agentOf(step: Step): AgentId | null {
  const agent = step.raw['agent']
  return typeof agent === 'string' ? agent : null
}

/**
 * One node in the agent run. `parents` are TRUE data-flow edges (this step's
 * inputs were produced by those steps' outputs), NOT merely "the previous step".
 */
export interface Step {
  /** stable step id, e.g. "s4" */
  id: string
  /** 0-based order in the run */
  index: number
  kind: StepKind
  /** named values this step consumed */
  inputs: Record<string, Json>
  /** what this step produced */
  output: Json
  /** agent-state snapshot AFTER this step (for fork/replay) */
  state: Record<string, Json>
  /** ids of steps whose outputs fed this step's inputs */
  parents: string[]
  tool_name?: string | null
  /** original span/checkpoint payload */
  raw: Record<string, Json>
  /** ground-truth labels (fixtures / fault-injected runs) */
  is_injected_fault?: boolean
  /** what this step should have produced */
  correct_output?: Json | null
}

/** A full recorded run. `success` is null until the oracle evaluates it. */
export interface Trace {
  id: string
  /** the task the agent was given */
  task: string
  steps: Step[]
  final_output: Json
  /** set by eval/oracle.evaluate() */
  success: boolean | null
}

/** A ranked suspect. `suspicion` blends node-judge verdict with a graph-depth prior. */
export interface Candidate {
  step_id: string
  /** ranked score in [0, 1] */
  suspicion: number
  /** short human-readable rationale */
  reason: string
}

/**
 * Output of localization: the earliest-wrong step plus the forward slice of
 * everything that inherited its output.
 */
export interface Attribution {
  trace_id: string
  /** localized earliest-wrong step */
  root_step_id: string
  /** step ids in the forward slice from root */
  blast_radius: string[]
  /** ranked; index 0 is the leading suspect */
  candidates: Candidate[]
  /** plain-English explanation of the root cause */
  rationale: string
  /** corrected output for the root step, usable as a replay injected_value (optional) */
  suggested_fix?: Json | null
}

/**
 * Output of an intervention. A NON-FLIP is a valid, expected result — it
 * disproves a candidate. Never treat `flipped === false` as an error.
 */
export interface ReplayResult {
  trace_id: string
  /** the step we forked at */
  step_id: string
  /** the corrected value we injected */
  injected_value: Json
  /** number of re-runs (web target is non-deterministic) */
  n: number
  /** did the outcome flip fail->pass at all */
  flipped: boolean
  /** fraction of n re-runs that passed, in [0, 1] */
  confirmation_rate: number
  /** per-run pass/fail */
  outcomes: boolean[]
  /** plain-English "why this fix works" (optional; LLM-generated live, template in mock) */
  explanation?: string | null
}

/**
 * The monitor's final verdict on a localized root cause: it replayed the fix,
 * scored the confirmation, and decided whether the correction can be trusted to
 * auto-apply or must be escalated to a human.
 *
 * COORDINATION: this is the 6th contract and currently a FRONTEND MIRROR ONLY.
 * `shared/schema.py` does not yet have the matching Pydantic model — adding it
 * must go through a coordinated PR with the backend workstream (do NOT edit
 * `shared/schema.py` from the web folder). Keep field names identical when that
 * model lands so the two stay in sync.
 */
export interface MonitorDecision {
  trace_id: string
  /** the localized step the monitor corrected */
  root_step_id: string
  /** the intervention outcome that backs this decision */
  replay: ReplayResult
  /** whether the confirmed fix is trustworthy enough to apply unattended */
  trusted: boolean
  /** auto-apply when trusted; escalate to a human otherwise */
  decision: 'auto_apply' | 'escalate'
}
