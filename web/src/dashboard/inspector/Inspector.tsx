import type { Attribution, Step } from '../../types'
import type { ActionNode } from '../types'
import { Field, RawPayload, Section } from './sections'
import '../dashboard.css'

function previewState(state: Step['state']): string {
  return Object.entries(state)
    .map(([k, v]) => `${k}: ${typeof v === 'object' ? JSON.stringify(v) : String(v)}`)
    .join('  ·  ')
}

export function Inspector({ node, steps, attribution, onReplay }: {
  node: ActionNode | null
  steps: Step[]
  attribution: Attribution
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
        <Field k="status" v={isRoot ? '● ROOT CAUSE' : node.id} tone={isRoot ? 'root' : undefined} />
      </Section>

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

      {candidate && (
        <Section title="node-judge · haiku" aside={`suspicion ${candidate.suspicion}`}>
          <div className="insp__judge">{candidate.reason}</div>
        </Section>
      )}

      <div className="insp__actions">
        <button type="button" className="insp__btn insp__btn--primary"
          onClick={() => onReplay(attribution.root_step_id)}>↻ Replay with fix</button>
      </div>
    </div>
  )
}
