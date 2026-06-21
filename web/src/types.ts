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
}

/** Trust gate: replay-proven fix is trusted, or escalated to a human. */
export interface MonitorDecision {
  trace_id: string
  root_step_id: string
  replay: ReplayResult
  trusted: boolean
  decision: 'auto_apply' | 'escalate'
}
