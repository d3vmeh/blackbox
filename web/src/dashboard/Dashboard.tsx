import { useCallback, useEffect, useMemo, useState } from 'react'
import { useReducedMotion } from 'motion/react'
import { useRun } from './data/useRun'
import { ReadoutBar } from './ReadoutBar'
import { CaseNav } from './CaseNav'
import { TraceGraph } from './graph/TraceGraph'
import { Inspector } from './inspector/Inspector'
import { LogConsole } from './console/LogConsole'
import { phaseForReplay, PHASE_STATUS, type Phase } from './phase'
import './dashboard.css'

export function Dashboard() {
  const { data, replay } = useRun()
  const reduce = useReducedMotion()
  // First paint lands on the WHY: select the root-cause node so the inspector is never empty.
  const rootNodeId = useMemo(
    () => data.graph.nodes.find((n) => n.stepIds.includes(data.attribution.root_step_id))?.id ?? null,
    [data.graph.nodes, data.attribution.root_step_id],
  )
  const [selectedId, setSelectedId] = useState<string | null>(rootNodeId)
  // Reduced motion: skip the cascade and render the localized view directly.
  const [phase, setPhase] = useState<Phase>(reduce ? 'analyze' : 'idle')

  useEffect(() => {
    if (reduce) return
    const t1 = window.setTimeout(() => setPhase('blast'), 600)
    const t2 = window.setTimeout(() => setPhase('analyze'), 3200)
    return () => { window.clearTimeout(t1); window.clearTimeout(t2) }
  }, [reduce])

  const selectedNode = useMemo(
    () => data.graph.nodes.find((n) => n.id === selectedId) ?? null,
    [data.graph.nodes, selectedId],
  )
  const selectedStepId = selectedNode ? selectedNode.stepIds[selectedNode.stepIds.length - 1] : null
  const verdict = phase === 'confirm' ? 'PASS' : 'FAIL'

  const onReplay = useCallback(async (stepId: string) => {
    const result = await replay(stepId, '2024-07-12')
    setPhase(phaseForReplay(result))
  }, [replay])

  // Keyboard-driven instrument: j/k (or ↓/↑) move the selection along the spine, r replays
  // the focused step. (DESIGN.md: blackbox is keyboard-first.)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return
      const nodes = data.graph.nodes
      const idx = nodes.findIndex((n) => n.id === selectedId)
      if (e.key === 'j' || e.key === 'ArrowDown') {
        e.preventDefault()
        setSelectedId(nodes[Math.min(nodes.length - 1, Math.max(0, idx) + 1)]?.id ?? selectedId)
      } else if (e.key === 'k' || e.key === 'ArrowUp') {
        e.preventDefault()
        setSelectedId(nodes[Math.max(0, (idx < 0 ? 0 : idx) - 1)]?.id ?? selectedId)
      } else if ((e.key === 'r' || e.key === 'R') && selectedNode) {
        e.preventDefault()
        void onReplay(selectedNode.stepIds[selectedNode.stepIds.length - 1])
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [data.graph.nodes, selectedId, selectedNode, onReplay])

  return (
    <div className="dash">
      <ReadoutBar
        runId={data.trace.id}
        task="flight-agent"
        verdict={verdict}
        meta={PHASE_STATUS[phase]}
      />
      <div className="dash__body">
        <CaseNav
          trace={data.trace}
          attribution={data.attribution}
          graph={data.graph}
          phase={phase}
          selectedId={selectedId}
          onSelect={setSelectedId}
        />
        <section className="dash__spine">
          <div className="pane__head">
            <span className="eyebrow">Provenance · trace</span>
            <span className="pane__hint tnum">{data.graph.nodes.length} actions · {data.trace.steps.length} steps</span>
          </div>
          <TraceGraph
            graph={data.graph}
            status={data.status}
            phase={phase}
            selectedId={selectedId}
            onSelect={setSelectedId}
          />
        </section>
        <aside className="dash__inspect">
          <div className="pane__head">
            <span className="eyebrow">Inspector</span>
            {selectedNode && <span className="pane__hint tnum">{selectedNode.id}</span>}
          </div>
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
