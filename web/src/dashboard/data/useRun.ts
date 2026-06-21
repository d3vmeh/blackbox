import { useCallback, useEffect, useMemo, useState } from 'react'
import type { Attribution, MonitorDecision, ReplayResult, Trace } from '../../types'
import type { ActionGraph } from '../types'
import { deriveActions } from '../deriveActions'
import { nodeStatus, type StatusMap } from '../nodeStatus'
import { loadRunMeta, type RunMeta } from './loadMeta'
import { loadMonitorDecision } from './loadMonitor'
import { nonFlip } from './replayMap'
import { loadStubMultiAgentTrace, STUB_MULTI_ATTRIBUTION } from './stubMultiAgentTrace'
import { STUB_MONITOR_DECISION } from './stubMonitor'

export interface RunData {
  trace: Trace
  attribution: Attribution
  graph: ActionGraph
  status: StatusMap
  meta: RunMeta
  monitor: MonitorDecision
  replays: Record<string, ReplayResult>
}

interface RunResponse {
  trace: Trace; attribution: Attribution; replay: Record<string, ReplayResult>
  meta?: RunMeta; monitor?: MonitorDecision   // the coding backend supplies these; claims fixtures don't
}

function toRunData(
  trace: Trace,
  attribution: Attribution,
  replays: Record<string, ReplayResult>,
  meta: RunMeta = loadRunMeta(),
  monitor: MonitorDecision = loadMonitorDecision(),
): RunData {
  const graph = deriveActions(trace)
  return { trace, attribution, graph, status: nodeStatus(graph, attribution), meta, monitor, replays }
}

// First paint shows the multi-agent demo trace (the redesign's topology view); the
// monitor's confirmed root replay is the only step that flips, every other fork is a
// non-flipping decoy. Picking a scenario + Run swaps in a live backend run below.
const FALLBACK_REPLAYS: Record<string, ReplayResult> = {
  [STUB_MONITOR_DECISION.root_step_id]: STUB_MONITOR_DECISION.replay,
}
const FALLBACK: RunData = toRunData(
  loadStubMultiAgentTrace(), STUB_MULTI_ATTRIBUTION, FALLBACK_REPLAYS,
  loadRunMeta(), STUB_MONITOR_DECISION,
)
const FALLBACK_SCENARIOS = [{ name: 'acme_amount', label: 'claims · acme amount' }]

export function useRun() {
  const [data, setData] = useState<RunData>(FALLBACK)
  const [scenarios, setScenarios] = useState<{ name: string; label: string }[]>(FALLBACK_SCENARIOS)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/scenarios')
      .then((r) => (r.ok ? r.json() : Promise.reject(r.status)))
      .then(setScenarios)
      .catch(() => { /* backend off → keep the fallback list */ })
  }, [])

  const run = useCallback(async (scenario: string, live = true) => {
    setLoading(true); setError(null)
    try {
      const r = await fetch('/api/run', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scenario, live }),
      })
      if (!r.ok) {
        const detail = await r.json().catch(() => ({}))
        throw new Error(typeof detail.detail === 'string' ? detail.detail : `run failed (${r.status})`)
      }
      const body: RunResponse = await r.json()
      // use the backend's meta/monitor when present (coding runs); else the static defaults
      setData(toRunData(body.trace, body.attribution, body.replay, body.meta, body.monitor))
    } catch (e) {
      setError(e instanceof Error ? e.message : 'run failed')
    } finally {
      setLoading(false)
    }
  }, [])

  const replay = useCallback(
    (stepId: string, _value: unknown) => Promise.resolve(data.replays[stepId] ?? nonFlip(stepId)),
    [data.replays],
  )

  return useMemo(() => ({ data, scenarios, loading, error, run, replay }),
                 [data, scenarios, loading, error, run, replay])
}
