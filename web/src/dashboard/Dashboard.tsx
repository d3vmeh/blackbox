import { useEffect, useMemo, useState } from 'react'
import { useReducedMotion } from 'motion/react'
import { useRun } from './data/useRun'
import { ReadoutBar } from './ReadoutBar'
import { TraceGraph } from './graph/TraceGraph'
import { Inspector } from './inspector/Inspector'
import { LogConsole } from './console/LogConsole'
import { phaseForReplay, PHASE_STATUS, type Phase } from './phase'
import type { ReplayResult } from '../types'
import './dashboard.css'

export function Dashboard() {
  const { data, scenarios, loading, error, run, replay } = useRun()
  const [picked, setPicked] = useState<string>('parse_duration_units')
  const reduce = useReducedMotion()
  // First paint lands on the WHY: select the root-cause node so the inspector is never empty.
  const rootNodeId = useMemo(
    () => data.graph.nodes.find((n) => n.stepIds.includes(data.attribution.root_step_id))?.id ?? null,
    [data.graph.nodes, data.attribution.root_step_id],
  )
  const [selectedId, setSelectedId] = useState<string | null>(rootNodeId)
  // Reduced motion: skip the cascade and render the localized view directly.
  const [phase, setPhase] = useState<Phase>(reduce ? 'analyze' : 'idle')
  // The last replay outcome (what was injected + whether it flipped), shown in the inspector.
  const [replayInfo, setReplayInfo] = useState<{ stepId: string; result: ReplayResult } | null>(null)

  // Selecting a different node clears the stale replay result.
  const selectNode = (id: string | null) => { setSelectedId(id); setReplayInfo(null) }

  // Each new run (data change) re-focuses the root cause and replays the cascade.
  useEffect(() => {
    setSelectedId(rootNodeId)
    setReplayInfo(null)
    if (reduce) { setPhase('analyze'); return }
    setPhase('idle')
    const t1 = window.setTimeout(() => setPhase('blast'), 600)
    const t2 = window.setTimeout(() => setPhase('analyze'), 3200)
    return () => { window.clearTimeout(t1); window.clearTimeout(t2) }
  }, [data, rootNodeId, reduce])

  const selectedNode = useMemo(
    () => data.graph.nodes.find((n) => n.id === selectedId) ?? null,
    [data.graph.nodes, selectedId],
  )
  const selectedStepId = selectedNode ? selectedNode.stepIds[selectedNode.stepIds.length - 1] : null
  const verdict = data.trace.success ? 'PASS' : phase === 'confirm' ? 'PASS' : 'FAIL'

  const onReplay = async (stepId: string) => {
    // The corrected value comes from the pre-generated replay result, keyed by step.
    const result = await replay(stepId, null)
    setReplayInfo({ stepId, result })
    setPhase(phaseForReplay(result))
  }

  return (
    <div className="dash">
      <div className="dash__run">
        <span className="dash__lab">test</span>
        <select className="dash__sel" value={picked} onChange={(e) => setPicked(e.target.value)} aria-label="test">
          {scenarios.map((s) => <option key={s.name} value={s.name}>{s.label}</option>)}
        </select>
        <button className="dash__btn" type="button" onClick={() => run(picked)} disabled={loading}>
          {loading ? 'running… (real Claude)' : 'Run'}
        </button>
        {error && <span className="dash__err">{error}</span>}
      </div>
      <ReadoutBar
        runId={data.trace.id}
        task={picked}
        verdict={verdict}
        meta={`${data.trace.steps.length} steps · ${PHASE_STATUS[phase]}`}
      />
      <div className="dash__body">
        <section className="dash__graph">
          <TraceGraph
            graph={data.graph}
            status={data.status}
            phase={phase}
            selectedId={selectedId}
            onSelect={selectNode}
          />
        </section>
        <aside className="dash__inspect">
          <Inspector
            node={selectedNode}
            steps={data.trace.steps}
            attribution={data.attribution}
            onReplay={onReplay}
            replayResult={replayInfo && replayInfo.stepId === selectedStepId ? replayInfo.result : null}
          />
        </aside>
      </div>
      <LogConsole steps={data.trace.steps} attribution={data.attribution} selectedStepId={selectedStepId} />
    </div>
  )
}
