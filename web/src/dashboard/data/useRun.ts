import { useMemo } from 'react'
import type { Attribution, MonitorDecision, ReplayResult, Trace } from '../../types'
import type { ActionGraph } from '../types'
import { deriveActions } from '../deriveActions'
import { nodeStatus, type StatusMap } from '../nodeStatus'
import { loadStubMultiAgentTrace, STUB_MULTI_ATTRIBUTION } from './stubMultiAgentTrace'
import { STUB_MONITOR_DECISION } from './stubMonitor'

export interface RunData {
  trace: Trace
  attribution: Attribution
  graph: ActionGraph
  status: StatusMap
  monitor: MonitorDecision
}

/**
 * Build a replay outcome for a forked step. The monitor's confirmed root replay
 * (STUB_MONITOR_DECISION) flips fail→pass; every other step is a decoy/ordinary
 * candidate whose correction does NOT flip the run (a valid, expected non-flip).
 *
 * Async shape so the SSE swap later is a drop-in (no caller change). The renderer
 * stays generic: swap the loader back to the single-agent fixture and the same
 * pipeline (deriveActions → nodeStatus → replay) still works.
 */
function replayFor(monitor: MonitorDecision, stepId: string, value: unknown): ReplayResult {
  if (stepId === monitor.root_step_id) return monitor.replay
  return {
    trace_id: monitor.trace_id,
    step_id: stepId,
    injected_value: value as ReplayResult['injected_value'],
    n: monitor.replay.n,
    flipped: false,
    confirmation_rate: 0,
    outcomes: Array.from({ length: monitor.replay.n }, () => false),
  }
}

export function useRun(): {
  data: RunData
  replay: (stepId: string, value: unknown) => Promise<ReplayResult>
} {
  const data = useMemo<RunData>(() => {
    const trace = loadStubMultiAgentTrace()
    const attribution = STUB_MULTI_ATTRIBUTION
    const graph = deriveActions(trace)
    const status = nodeStatus(graph, attribution)
    return { trace, attribution, graph, status, monitor: STUB_MONITOR_DECISION }
  }, [])

  const replay = (stepId: string, value: unknown) =>
    Promise.resolve(replayFor(data.monitor, stepId, value))

  return { data, replay }
}
