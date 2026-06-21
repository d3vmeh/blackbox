import type { Attribution, MonitorDecision, Step } from '../../types'
import type { ActionNode } from '../types'
import type { RunMeta } from '../data/loadMeta'
import { Field, RawPayload, Section } from './sections'
import '../dashboard.css'

function previewState(state: Step['state']): string {
  return Object.entries(state)
    .map(([k, v]) => `${k}: ${typeof v === 'object' ? JSON.stringify(v) : String(v)}`)
    .join('  ·  ')
}

export function Inspector({ node, steps, attribution, runMeta, monitor, onReplay }: {
  node: ActionNode | null
  steps: Step[]
  attribution: Attribution
  runMeta: RunMeta
  monitor: MonitorDecision
  onReplay: (stepId: string) => void
}) {
  if (!node) {
    return <div className="insp insp--empty">Select a node to inspect its telemetry.</div>
  }
  const byId = new Map(steps.map((s) => [s.id, s]))
  const focusId = node.stepIds[node.stepIds.length - 1] // the result step
  const step = byId.get(focusId)
  if (!step) return <div className="insp insp--empty">Step {focusId} not found.</div>
  const candidate = attribution.candidates.find((c) => node.stepIds.includes(c.step_id))
  const isRoot = node.stepIds.includes(attribution.root_step_id)

  return (
    <div className="insp">
      <Section title="identity" aside={step.kind}>
        <Field k="step" v={`${step.id} (idx ${step.index})`} />
        {step.tool_name && <Field k="tool" v={step.tool_name} />}
        <Field k="runtime" v={String(step.raw.runtime ?? '—')} />
        <Field k="status" v={isRoot ? '● ROOT CAUSE' : node.id} tone={isRoot ? 'root' : undefined} />
      </Section>

      {runMeta.runtime === 'langgraph' && (
        <Section title="LangGraph" aside={runMeta.engine}>
          <Field k="apis" v={runMeta.apis.join(' · ')} />
          <Field k="checkpoints" v={`${runMeta.checkpoints} saved`} />
          <Field k="capture" v={runMeta.capture_path} />
          {isRoot && (
            <Field
              k="fork replay"
              v={`update_state(as_node=${runMeta.fork_node}) → invoke`}
              tone="good"
            />
          )}
        </Section>
      )}

      <Section title="data flow">
        <Field k="inputs" v={JSON.stringify(step.inputs)} />
        <Field k="output" v={JSON.stringify(step.output)} tone="bad" />
      </Section>

      <Section title="raw payload" aside="output.json">
        <RawPayload value={step.output} />
      </Section>

      <Section title="state diff · after step" aside="state">
        <div className="insp__diff">{previewState(step.state)}</div>
      </Section>

      <Section title="provenance" aside={`${step.parents.length} parent(s)`}>
        <Field k="parents" v={step.parents.join(', ') || '—'} />
      </Section>

      {isRoot && (
        <Section title="supervise · trust gate" aside={monitor.decision}>
          <Field k="trusted" v={monitor.trusted ? 'yes' : 'no'} tone={monitor.trusted ? 'good' : undefined} />
          <Field k="decision" v={monitor.decision} tone={monitor.trusted ? 'good' : undefined} />
          <Field k="confirmation" v={`${Math.round(monitor.replay.confirmation_rate * 100)}% over n=${monitor.replay.n}`} />
        </Section>
      )}
      {candidate && (
        <Section title="node-judge · haiku" aside={`suspicion ${candidate.suspicion}`}>
          <div className="insp__judge">{candidate.reason}</div>
        </Section>
      )}

      <div className="insp__actions">
        {/* Replay the FOCUSED step, not always the root — so replaying a decoy/ordinary
            candidate yields a visible non-flip (the rejection beat), and only the true
            root flips fail→pass. */}
        <button type="button" className="insp__btn insp__btn--primary"
          onClick={() => onReplay(focusId)}>
          {isRoot ? '↻ Replay with fix' : '↻ Replay candidate'}
        </button>
      </div>
    </div>
  )
}
