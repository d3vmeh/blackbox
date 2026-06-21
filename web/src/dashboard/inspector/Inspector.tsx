import type { Attribution, Json, ReplayResult, Step } from '../../types'
import type { ActionNode } from '../types'
import { CodeBlock } from './CodeBlock'
import { Field, RawPayload, Section } from './sections'
import '../dashboard.css'

// After a replay, spell out exactly WHAT was changed (field: bad → good, or the
// corrected code) and whether the outcome flipped — so the proof is legible, not implicit.
function ReplayOutcome({ result, agent, output }: {
  result: ReplayResult; agent: string; output: Json
}) {
  const injected = result.injected_value
  const fields = injected && typeof injected === 'object' && !Array.isArray(injected)
    ? Object.entries(injected) : []
  const before = (k: string) =>
    output && typeof output === 'object' && !Array.isArray(output) ? output[k] : undefined
  const passed = result.outcomes.filter(Boolean).length
  const names = fields.map(([k]) => k).join(', ') || 'output'
  return (
    <div className={`insp__replay insp__replay--${result.flipped ? 'pass' : 'reject'}`}>
      <div className="insp__replayhd">{result.flipped ? '✓ FIX CONFIRMED' : '✗ NOT THE CAUSE'}</div>
      {fields.length > 0 && (
        <div className="insp__fix">
          {fields.map(([k, v]) =>
            typeof v === 'string' && (v.includes('\n') || k === 'code' || k === 'tests') ? (
              <div key={k} className="insp__fixcode">
                <div className="insp__codek">corrected {k}</div>
                <CodeBlock code={v} />
              </div>
            ) : (
              <div key={k} className="insp__fixrow">
                <span className="insp__fixk">{k}</span>
                <span className="insp__fixbefore">{String(before(k))}</span>
                <span className="insp__fixarrow">→</span>
                <span className="insp__fixafter">{typeof v === 'object' ? JSON.stringify(v) : String(v)}</span>
              </div>
            ),
          )}
        </div>
      )}
      {result.flipped && result.explanation && (
        <p className="insp__replayexpl">{result.explanation}</p>
      )}
      <p className="insp__replaywhy">
        {result.flipped
          ? `Re-ran with ${agent}'s ${names} corrected → the run flipped FAIL → PASS (${passed}/${result.n} replays). That intervention proves ${agent} is the root cause.`
          : `Re-ran with ${agent}'s output corrected → no change, still FAIL (${passed}/${result.n}). That proves ${agent} is not the cause.`}
      </p>
    </div>
  )
}

function previewInputs(inputs: Record<string, Json>): string {
  return Object.entries(inputs)
    .map(([k, v]) => `${k}: ${typeof v === 'object' ? JSON.stringify(v) : String(v)}`)
    .join('  ·  ')
}

// Render an agent's output legibly: multi-line string fields (code, tests) as
// syntax-highlighted blocks; scalars as key/value rows; the raw JSON stays one
// click away (a <details> toggle) so nothing is hidden.
function ProducedOutput({ output }: { output: Json }) {
  if (output === null || typeof output !== 'object' || Array.isArray(output)) {
    return <RawPayload value={output} />
  }
  const entries = Object.entries(output)
  return (
    <>
      {entries.map(([k, v]) =>
        typeof v === 'string' && (v.includes('\n') || k === 'code' || k === 'tests') ? (
          <div key={k} className="insp__codewrap">
            <div className="insp__codek">{k}</div>
            <CodeBlock code={v} />
          </div>
        ) : (
          <Field key={k} k={k} v={typeof v === 'object' ? JSON.stringify(v) : String(v)} />
        ),
      )}
      <details className="insp__raw">
        <summary>raw JSON</summary>
        <RawPayload value={output} />
      </details>
    </>
  )
}

const VERDICT_LABEL = { root: '● ROOT CAUSE', blast: '● AFFECTED', ok: 'OK' } as const

export function Inspector({ node, steps, attribution, onReplay, replayResult }: {
  node: ActionNode | null
  steps: Step[]
  attribution: Attribution
  onReplay: (stepId: string) => void
  replayResult?: ReplayResult | null
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
        <ProducedOutput output={step.output} />
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

      {replayResult && <ReplayOutcome result={replayResult} agent={node.label} output={step.output} />}
    </div>
  )
}
