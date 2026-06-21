import { useMemo } from 'react'
import type { Attribution, ReplayResult, Trace } from '../../types'
import type { ActionGraph } from '../types'
import { deriveActions } from '../deriveActions'
import { nodeStatus, type StatusMap } from '../nodeStatus'
import { loadFixtureTrace } from './loadFixture'
import { STUB_ATTRIBUTION } from './stubAttribution'
import { stubReplay } from './stubReplay'

export interface RunData {
  trace: Trace
  attribution: Attribution
  graph: ActionGraph
  status: StatusMap
}

export function useRun(): {
  data: RunData
  replay: (stepId: string, value: unknown) => Promise<ReplayResult>
} {
  const data = useMemo<RunData>(() => {
    const trace = loadFixtureTrace()
    const attribution = STUB_ATTRIBUTION
    const graph = deriveActions(trace)
    const status = nodeStatus(graph, attribution)
    return { trace, attribution, graph, status }
  }, [])

  // Async shape now so the SSE swap later is a drop-in (no caller change).
  const replay = (stepId: string, value: unknown) => Promise.resolve(stubReplay(stepId, value))

  return { data, replay }
}
