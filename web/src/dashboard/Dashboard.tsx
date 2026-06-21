import { useCallback, useEffect, useMemo, useState } from 'react'
import { useReducedMotion } from 'motion/react'
import type { AgentId, ReplayResult } from '../types'
import { useRun } from './data/useRun'
import { ReadoutBar } from './ReadoutBar'
import { MonitorRail } from './MonitorRail'
import { Topology } from './Topology'
import { TraceGraph } from './graph/TraceGraph'
import { Inspector } from './inspector/Inspector'
import { MonitorPanel, type MonitorLine } from './MonitorPanel'
import { StatsOverlay } from './StatsOverlay'
import { LogConsole } from './console/LogConsole'
import { deriveStats } from './deriveStats'
import { deriveTopology } from './deriveTopology'
import { phaseForReplay, PHASE_STATUS, trustForPhase, type Phase } from './phase'
import './dashboard.css'

// The supervise climax runs as a short scripted sequence once the root replay
// fires: replay the decoy first (no flip), visibly re-target, then the root flips.
const DECOY_MS = 1100

export function Dashboard() {
  const { data, scenarios, loading, error, run, replay } = useRun()
  const [picked, setPicked] = useState<string>('acme_amount')
  const reduce = useReducedMotion()
  // First paint lands on the WHY: select the root-cause node so the inspector is never empty.
  const rootNodeId = useMemo(
    () => data.graph.nodes.find((n) => n.stepIds.includes(data.attribution.root_step_id))?.id ?? null,
    [data.graph.nodes, data.attribution.root_step_id],
  )
  const [selectedId, setSelectedId] = useState<string | null>(rootNodeId)
  const [selectedAgentId, setSelectedAgentId] = useState<AgentId | null>(null)
  // The floating monitor can be dismissed; a fresh replay re-opens it.
  const [monitorDismissed, setMonitorDismissed] = useState(false)
  // Reduced motion: skip the cascade and render the localized view directly.
  const [phase, setPhase] = useState<Phase>(reduce ? 'analyze' : 'idle')
  // The full-width statistics overlay (toggled from the readout bar / `s` key).
  const [statsOpen, setStatsOpen] = useState(false)
  // The last replay outcome (what was injected + whether it flipped), shown in the inspector.
  const [replayInfo, setReplayInfo] = useState<{ stepId: string; result: ReplayResult } | null>(null)

  // Topology is derived once and drives the agent-wiring strip above the graph.
  const topology = useMemo(
    () => deriveTopology(data.graph, data.attribution),
    [data.graph, data.attribution],
  )
  // Usage statistics — per-agent + aggregate, derived once from the trace.
  const stats = useMemo(() => deriveStats(data.trace), [data.trace])

  // Selecting a different node clears the stale replay result.
  const selectNode = useCallback((id: string | null) => { setSelectedId(id); setReplayInfo(null) }, [])

  // Keep the picked scenario valid for the served list (the live backend serves the coding
  // scenarios; the default 'acme_amount' isn't among them, so Run would 404 without this).
  useEffect(() => {
    // Intentional: re-sync the picked scenario to the served list once it loads.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (scenarios.length && !scenarios.some((s) => s.name === picked)) setPicked(scenarios[0].name)
  }, [scenarios, picked])

  // Each new run (data change) re-focuses the root cause and replays the cascade.
  useEffect(() => {
    // Intentional: reset the demo's selection/phase state to sync with each new run.
    /* eslint-disable react-hooks/set-state-in-effect */
    setSelectedId(rootNodeId)
    setReplayInfo(null)
    if (reduce) { setPhase('analyze'); return }
    setPhase('idle')
    const t1 = window.setTimeout(() => setPhase('blast'), 600)
    const t2 = window.setTimeout(() => setPhase('analyze'), 3200)
    /* eslint-enable react-hooks/set-state-in-effect */
    return () => { window.clearTimeout(t1); window.clearTimeout(t2) }
  }, [data, rootNodeId, reduce])

  const selectedNode = useMemo(
    () => data.graph.nodes.find((n) => n.id === selectedId) ?? null,
    [data.graph.nodes, selectedId],
  )
  const selectedStepId = selectedNode ? selectedNode.stepIds[selectedNode.stepIds.length - 1] : null

  const onSelectAgent = useCallback((agentId: AgentId) => {
    // Toggle: clicking the live agent again clears the filter (all bands live).
    setSelectedAgentId((cur) => (cur === agentId ? null : agentId))
  }, [])

  // The confirm climax: replay the focused step. If it is the true root the
  // monitor proves the decoy first (no flip), re-targets, then the root flips →
  // confirm. A non-root candidate replays straight to the rejection beat.
  const onReplay = useCallback(async (stepId: string) => {
    setMonitorDismissed(false) // a fresh replay re-opens the monitor
    const result = await replay(stepId, null)
    setReplayInfo({ stepId, result })
    const settled = phaseForReplay(result) // 'confirm' | 'rejected'
    if (reduce || settled === 'rejected') {
      setPhase(settled)
      return
    }
    // Scripted root climax: prove the decoy first, then re-target onto the root.
    setPhase('proving_decoy')
    window.setTimeout(() => setPhase('proving_root'), DECOY_MS)
    window.setTimeout(() => setPhase('confirm'), DECOY_MS * 2)
  }, [replay, reduce])

  // The floating monitor's live play-by-play, driven by the phase machine.
  const monitorOpen = !monitorDismissed &&
    (phase === 'proving_decoy' || phase === 'proving_root' || phase === 'confirm')
  const monitorLines = useMemo<MonitorLine[]>(() => {
    const decoyStep = data.attribution.candidates[1]?.step_id
    const rootStep = data.attribution.root_step_id
    const n = data.monitor.replay.n
    const lines: MonitorLine[] = [{ text: '◉ localizing root cause…' }]
    if (phase === 'proving_decoy' || phase === 'proving_root' || phase === 'confirm') {
      lines.push({ text: `replay ${decoyStep ?? 'decoy'} · 0/${n}`, tone: 'reject' })
      lines.push({ text: 'decoy rejected · re-targeting', tone: 'reject' })
    }
    if (phase === 'proving_root' || phase === 'confirm') {
      lines.push({ text: `replay ${rootStep} · root cause` })
    }
    if (phase === 'confirm') {
      lines.push({ text: `flip fail → pass · ${n}/${n}`, tone: 'pass' })
      lines.push({ text: '✓ TRUSTED · auto-apply', tone: 'pass' })
    }
    return lines
  }, [phase, data.attribution, data.monitor.replay.n])

  const verdict = phase === 'confirm' || data.trace.success ? 'PASS' : 'FAIL'
  const trust = trustForPhase(phase)
  const proving = phase === 'proving_decoy' || phase === 'proving_root'
  const rate = proving ? 0 : data.monitor.replay.confirmation_rate
  const replayN = data.monitor.replay.n
  const monitorLabel = phase === 'confirm' ? data.monitor.decision : null

  // Keyboard-driven instrument: j/k (or ↓/↑) move the selection along the spine, r replays
  // the focused step. (DESIGN.md: blackbox is keyboard-first.)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return
      const nodes = data.graph.nodes
      const idx = nodes.findIndex((n) => n.id === selectedId)
      if (e.key === 's' || e.key === 'S') {
        e.preventDefault()
        setStatsOpen((cur) => !cur)
      } else if (e.key === 'Escape') {
        setStatsOpen(false)
      } else if (e.key === 'j' || e.key === 'ArrowDown') {
        e.preventDefault()
        selectNode(nodes[Math.min(nodes.length - 1, Math.max(0, idx) + 1)]?.id ?? selectedId)
      } else if (e.key === 'k' || e.key === 'ArrowUp') {
        e.preventDefault()
        selectNode(nodes[Math.max(0, (idx < 0 ? 0 : idx) - 1)]?.id ?? selectedId)
      } else if ((e.key === 'r' || e.key === 'R') && selectedNode) {
        e.preventDefault()
        void onReplay(selectedNode.stepIds[selectedNode.stepIds.length - 1])
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [data.graph.nodes, selectedId, selectedNode, onReplay, selectNode])

  return (
    <div className="dash">
      <MonitorRail
        trace={data.trace}
        attribution={data.attribution}
        graph={data.graph}
        phase={phase}
        selectedId={selectedId}
        onSelect={selectNode}
        topology={topology}
        selectedAgentId={selectedAgentId}
        onSelectAgent={onSelectAgent}
        monitor={data.monitor}
      />
      <div className="dash__tile">
        <ReadoutBar
          runId={data.trace.id}
          task={data.trace.task}
          verdict={verdict}
          meta={PHASE_STATUS[phase]}
          trust={trust}
          rate={rate}
          n={replayN}
          runtime={data.meta.domain ?? data.meta.runtime}
          monitorDecision={monitorLabel}
          statsOpen={statsOpen}
          onToggleStats={() => setStatsOpen((cur) => !cur)}
        />
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
        <div className="dash__work">
          <section className="dash__spine">
            <div className="pane__head">
              <span className="eyebrow">Topology · agent wiring</span>
              <span className="pane__hint tnum">{topology.agents.length} agents · {topology.handoffs.length} handoffs</span>
            </div>
            <Topology topology={topology} phase={phase} />
            <div className="pane__head pane__head--spine">
              <span className="eyebrow">Provenance · trace</span>
              <span className="pane__hint tnum">{data.graph.nodes.length} actions · {data.trace.steps.length} steps</span>
            </div>
            <div className="dash__spine-scroll">
              <TraceGraph
                graph={data.graph}
                status={data.status}
                phase={phase}
                selectedId={selectedId}
                onSelect={selectNode}
              />
            </div>
            <MonitorPanel open={monitorOpen} lines={monitorLines} trust={trust} onClose={() => setMonitorDismissed(true)} />
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
              runMeta={data.meta}
              monitor={data.monitor}
              onReplay={onReplay}
              nodes={data.graph.nodes}
              onSelect={selectNode}
              replayResult={replayInfo && replayInfo.stepId === selectedStepId ? replayInfo.result : null}
            />
          </aside>
        </div>
        <LogConsole steps={data.trace.steps} attribution={data.attribution} selectedStepId={selectedStepId} />
        <StatsOverlay open={statsOpen} stats={stats} onClose={() => setStatsOpen(false)} />
      </div>
    </div>
  )
}
