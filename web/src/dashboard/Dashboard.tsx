import { useMemo, useState } from 'react'
import { useRun } from './data/useRun'
import { ReadoutBar } from './ReadoutBar'
import { TraceGraph } from './graph/TraceGraph'
import { Inspector } from './inspector/Inspector'
import { LogConsole } from './console/LogConsole'
import { phaseForReplay, PHASE_STATUS, type Phase } from './phase'
import './dashboard.css'

export function Dashboard() {
  const { data, replay } = useRun()
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [phase, setPhase] = useState<Phase>('analyze') // localized view by default

  const selectedNode = useMemo(
    () => data.graph.nodes.find((n) => n.id === selectedId) ?? null,
    [data.graph.nodes, selectedId],
  )
  const selectedStepId = selectedNode ? selectedNode.stepIds[selectedNode.stepIds.length - 1] : null
  const verdict = phase === 'confirm' ? 'PASS' : 'FAIL'

  const onReplay = async (stepId: string) => {
    const result = await replay(stepId, '2024-07-12')
    setPhase(phaseForReplay(result))
  }

  return (
    <div className="dash">
      <ReadoutBar
        runId={data.trace.id}
        task="flight-agent"
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
            onSelect={setSelectedId}
          />
        </section>
        <aside className="dash__inspect">
          <Inspector
            node={selectedNode}
            steps={data.trace.steps}
            attribution={data.attribution}
            onReplay={onReplay}
          />
        </aside>
      </div>
      <LogConsole steps={data.trace.steps} attribution={data.attribution} selectedStepId={selectedStepId} />
    </div>
  )
}
