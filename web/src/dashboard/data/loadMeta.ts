import type { Json } from '../../types'
import data from '../../../../shared/fixtures/flight_run/meta.json'

/** LangGraph runtime metadata (p2/langgraph-clean → dashboard). */
export interface RunMeta {
  runtime: string
  author: string
  engine: string
  apis: string[]
  graph_nodes: string[]
  checkpoints: number
  to_trace_steps: number
  recorder_steps: number
  capture_path: string
  replay_path: string
  fork_node: string
  thread_id: string
}

export function loadRunMeta(): RunMeta {
  return data as unknown as RunMeta
}

export function isLangGraphStep(raw: Record<string, Json>): boolean {
  return raw.runtime === 'langgraph'
}
