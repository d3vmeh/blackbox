import type { Json } from '../../types'
import data from '../../../../shared/fixtures/claim_run/meta.json'

/** Runtime metadata from fixture meta.json (LangGraph flight or multi-agent claims). */
export interface RunMeta {
  runtime: string
  engine: string
  /** LangGraph flight export */
  author?: string
  apis?: string[]
  graph_nodes?: string[]
  checkpoints?: number
  to_trace_steps?: number
  recorder_steps?: number
  capture_path?: string
  replay_path?: string
  fork_node?: string
  thread_id?: string
  /** Multi-agent claims export */
  domain?: string
  pipeline?: string[]
  agent_labels?: Record<string, string>
  scenario?: string
  parallel_agents?: string[]
  fork_agent?: string
  monitor_decision?: string
}

export function loadRunMeta(): RunMeta {
  return data as unknown as RunMeta
}

export function isLangGraphStep(raw: Record<string, Json>): boolean {
  return raw.runtime === 'langgraph'
}
