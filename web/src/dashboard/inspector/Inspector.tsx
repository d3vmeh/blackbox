import type { Attribution, Json, Step } from '../../types'
import type { ActionNode } from '../types'
import { RawPayload, Section } from './sections'
import '../dashboard.css'

function previewInputs(inputs: Record<string, Json>): string {
  return Object.entries(inputs)
    .map(([k, v]) => `${k}: ${typeof v === 'object' ? JSON.stringify(v) : String(v)}`)
    .join('  ·  ')
}

const VERDICT_LABEL = { root: '● ROOT CAUSE', blast: '● AFFECTED', ok: 'OK' } as const

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
  const isBlast = !isRoot && node.stepIds.some((s) => attribution.blast_radius.includes(s))
  const verdict = isRoot ? 'root' : isBlast ? 'blast' : 'ok'

  return (
    <div className="insp">
      <div className="insp__head">
        <span className="insp__agent">{node.label}</span>
        <span className={`insp__pill insp__pill--${verdict}`}>{VERDICT_LABEL[verdict]}</span>
      </div>

      {/* The WHY — pulled straight from localization, in plain English. */}
      {isRoot && candidate && (
        <div className="insp__call insp__call--root">
          <div className="insp__callk">What went wrong</div>
          <div className="insp__callv">{candidate.reason}</div>
          <div className="insp__callsub">leading suspect · suspicion {candidate.suspicion}</div>
        </div>
      )}
      {isRoot && attribution.rationale && (
        <p className="insp__why">{attribution.rationale}</p>
      )}
      {isBlast && candidate && (
        <div className="insp__call insp__call--blast">
          <div className="insp__callk">Affected by the root cause</div>
          <div className="insp__callv">{candidate.reason}</div>
          <div className="insp__callsub">suspicion {candidate.suspicion}</div>
        </div>
      )}

      <Section title="what it produced" aside="output">
        <RawPayload value={step.output} />
      </Section>

      <Section title="inputs" aside={`${step.parents.length} source(s)`}>
        <div className="insp__diff">{previewInputs(step.inputs) || '—'}</div>
      </Section>

      <div className="insp__actions">
        {/* Replay the FOCUSED step: the true root flips FAIL→PASS; a decoy candidate
            does not — that non-flip is the proof it was not the cause. */}
        <button type="button" className="insp__btn insp__btn--primary"
          onClick={() => onReplay(focusId)}>
          {isRoot ? '↻ Replay with fix' : '↻ Replay candidate'}
        </button>
        <span className="insp__hint">
          {isRoot
            ? 'fork here · inject the fix · re-run → expect FAIL → PASS'
            : 'fork here · re-run → expect no change (proves it is not the cause)'}
        </span>
      </div>
    </div>
  )
}
