import type { Attribution, Json, MonitorDecision, ReplayResult, Step } from '../../types'
import type { ActionNode } from '../types'
import type { RunMeta } from '../data/loadMeta'
import { CodeBlock } from './CodeBlock'
import { Field, RawPayload, Section } from './sections'
import '../dashboard.css'

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

export function Inspector({ node, steps, attribution, runMeta, monitor, onReplay, replayResult }: {
  node: ActionNode | null
  steps: Step[]
  attribution: Attribution
  runMeta: RunMeta
  monitor: MonitorDecision
  onReplay: (stepId: string) => void
  replayResult?: ReplayResult | null
}) {
  if (!node) {
    return <div className="insp insp--empty">Select a node to inspect its telemetry.</div>
  }
  const byId = new Map(steps.map((s) => [s.id, s]))
  const focusId = node.stepIds[node.stepIds.length - 1]
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

      {runMeta.runtime === 'langgraph' && (
        <Section title="LangGraph" aside={runMeta.engine}>
          <Field k="apis" v={(runMeta.apis ?? []).join(' · ')} />
          <Field k="checkpoints" v={`${runMeta.checkpoints ?? 0} saved`} />
          <Field k="capture" v={runMeta.capture_path ?? '—'} />
          {isRoot && runMeta.fork_node && (
            <Field
              k="fork replay"
              v={`update_state(as_node=${runMeta.fork_node}) → invoke`}
              tone="good"
            />
          )}
        </Section>
      )}

      {runMeta.runtime === 'multi-agent' && (
        <Section title="multi-agent hand-off" aside={runMeta.engine}>
          <Field k="agent" v={String(step.raw.display ?? step.raw.agent ?? '—')} />
          {runMeta.parallel_agents && (
            <Field k="parallel" v={runMeta.parallel_agents.join(' ∥ ')} />
          )}
          {isRoot && runMeta.fork_agent && (
            <Field k="fork replay" v={`inject at ${runMeta.fork_agent} → re-run pipeline`} tone="good" />
          )}
        </Section>
      )}

      <Section title="what it produced" aside="output">
        <ProducedOutput output={step.output} />
      </Section>

      <Section title="inputs" aside={`${step.parents.length} source(s)`}>
        <div className="insp__diff">{previewInputs(step.inputs) || '—'}</div>
      </Section>

      {isRoot && (
        <Section title="supervise · trust gate" aside={monitor.decision}>
          <Field k="trusted" v={monitor.trusted ? 'yes' : 'no'} tone={monitor.trusted ? 'good' : undefined} />
          <Field k="decision" v={monitor.decision} tone={monitor.trusted ? 'good' : undefined} />
          <Field k="confirmation" v={`${Math.round(monitor.replay.confirmation_rate * 100)}% over n=${monitor.replay.n}`} />
        </Section>
      )}

      <div className="insp__actions">
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
