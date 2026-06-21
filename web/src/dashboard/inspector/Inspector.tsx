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
  const blast = new Set(attribution.blast_radius)
  const isBlast = !isRoot && node.stepIds.some((s) => blast.has(s))
  // One-word classification for the header pill (shape/label, not color-only).
  const klass = isRoot ? 'root' : isBlast ? 'blast' : candidate ? 'suspect' : 'ordinary'
  const KLASS_LABEL: Record<string, string> = {
    root: '● root cause', blast: '▸ blast radius', suspect: '◌ suspect', ordinary: '· ordinary',
  }

  return (
    <div className="insp">
      <div className="insp__hd">
        <span className="insp__hdid tnum">{step.id}</span>
        <span className="insp__hdkind">{step.tool_name ?? step.kind}</span>
        <span className="insp__pill" data-klass={klass}>{KLASS_LABEL[klass]}</span>
      </div>

      <Section title="data flow">
        <Field k="inputs" v={JSON.stringify(step.inputs)} />
        <Field k="output" v={JSON.stringify(step.output)} tone={isRoot || isBlast ? 'bad' : undefined} />
      </Section>

      <Section title="raw payload" aside="output.json">
        <RawPayload value={step.output} />
      </Section>

      <Section title="state · after step" aside="snapshot">
        <div className="insp__diff">{previewState(step.state)}</div>
      </Section>

      <Section title="provenance" aside={`${step.parents.length} parent(s)`}>
        <Field k="parents" v={step.parents.join(', ') || '—'} />
      </Section>

      {candidate && (
        <Section title="node-judge · haiku" aside={`suspicion ${candidate.suspicion.toFixed(2)}`}>
          <div className="insp__judge" data-klass={isRoot ? 'root' : 'neutral'}>{candidate.reason}</div>
        </Section>
      )}

      {isRoot && (
        <Section title="localization" aside="rationale">
          <p className="insp__rationale">{attribution.rationale}</p>
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
        <span className="insp__hint">
          fork at <b className="tnum">{focusId}</b> · inject corrected value · replay ×5
        </span>
      </div>
    </div>
  )
}
