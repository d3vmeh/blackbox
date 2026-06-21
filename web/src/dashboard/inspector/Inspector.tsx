import { agentOf } from '../../types'
import type { Attribution, Json, MonitorDecision, ReplayResult, Step } from '../../types'
import type { ActionNode } from '../types'
import type { RunMeta } from '../data/loadMeta'
import { CodeBlock } from './CodeBlock'
import { Field, ProvenanceList, RawPayload, Section } from './sections'
import type { ParentLink } from './sections'
import '../dashboard.css'
import './Inspector.css'

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

export function Inspector({ node, steps, attribution, onReplay, nodes, onSelect, runMeta, monitor, replayResult }: {
  node: ActionNode | null
  steps: Step[]
  attribution: Attribution
  onReplay: (stepId: string) => void
  /** all action nodes — used to resolve a cross-agent parent's owning node for the jump */
  nodes?: ActionNode[]
  /** jump to another action node (e.g. a cross-agent producer) by node id */
  onSelect?: (nodeId: string) => void
  /** runtime metadata — drives the LangGraph / multi-agent provenance sections when present */
  runMeta?: RunMeta
  /** the trust-gate decision — shown on the root step when present */
  monitor?: MonitorDecision
  /** the last replay outcome for this step (before → after + flip) */
  replayResult?: ReplayResult | null
}) {
  if (!node) {
    return <div className="insp insp--empty">Select a node to inspect its telemetry.</div>
  }
  const byId = new Map(steps.map((s) => [s.id, s]))
  const focusId = node.stepIds[node.stepIds.length - 1]
  const step = byId.get(focusId)
  if (!step) return <div className="insp insp--empty">Step {focusId} not found.</div>

  // Cross-agent provenance: resolve each parent's owning agent + the node that
  // contains it, so a parent produced by a DIFFERENT agent becomes a clickable jump.
  const selfAgent = agentOf(step)
  const parentLinks: ParentLink[] = step.parents.map((pid) => {
    const parent = byId.get(pid)
    const parentAgent = parent ? agentOf(parent) : null
    const owningNode = nodes?.find((n) => n.stepIds.includes(pid)) ?? null
    return {
      stepId: pid,
      agentLabel: parentAgent,
      crossAgent: parentAgent != null && parentAgent !== selfAgent,
      nodeId: owningNode?.id ?? null,
    }
  })
  const crossAgentCount = parentLinks.filter((p) => p.crossAgent).length
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
      <div className="insp__scroll">
      <div className="insp__hd">
        <span className="insp__hdid tnum">{step.id}</span>
        <span className="insp__hdkind">{step.tool_name ?? step.kind}</span>
        <span className="insp__pill" data-klass={klass}>{KLASS_LABEL[klass]}</span>
      </div>

      {/* Lead with the finding — the one thing that explains WHY this step is flagged. */}
      {candidate && (
        <Section title="what went wrong" aside={`suspicion ${candidate.suspicion.toFixed(2)}`}>
          <div className="insp__judge" data-klass={isRoot ? 'root' : 'neutral'}>{candidate.reason}</div>
        </Section>
      )}

      {runMeta?.runtime === 'langgraph' && (
        <Section title="LangGraph" aside={runMeta.engine}>
          <Field k="apis" v={(runMeta.apis ?? []).join(' · ')} />
          <Field k="checkpoints" v={`${runMeta.checkpoints ?? 0} saved`} />
          <Field k="capture" v={runMeta.capture_path ?? '—'} />
          {isRoot && runMeta.fork_node && (
            <Field k="fork replay" v={`update_state(as_node=${runMeta.fork_node}) → invoke`} tone="good" />
          )}
        </Section>
      )}

      {runMeta?.runtime === 'multi-agent' && (
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

      {Object.keys(step.inputs).length > 0 && (
        <Section title="inputs">
          <RawPayload value={step.inputs} />
        </Section>
      )}

      <Section
        title="came from"
        aside={crossAgentCount > 0
          ? `${step.parents.length} parent · ${crossAgentCount} cross-agent`
          : `${step.parents.length} parent`}
      >
        <ProvenanceList parents={parentLinks} onJump={onSelect} />
      </Section>

      {isRoot && monitor && (
        <Section title="supervise · trust gate" aside={monitor.decision}>
          <Field k="trusted" v={monitor.trusted ? 'yes' : 'no'} tone={monitor.trusted ? 'good' : undefined} />
          <Field k="decision" v={monitor.decision} tone={monitor.trusted ? 'good' : undefined} />
          <Field k="confirmation" v={`${Math.round(monitor.replay.confirmation_rate * 100)}% over n=${monitor.replay.n}`} />
        </Section>
      )}

      {isRoot && (
        <Section title="why it's the root cause">
          <p className="insp__rationale">{attribution.rationale}</p>
        </Section>
      )}

      </div>
      <div className="insp__actions">
        <button type="button" className="insp__btn insp__btn--primary"
          onClick={() => onReplay(focusId)}>
          {isRoot ? '↻ Replay with fix' : '↻ Replay candidate'}
        </button>
        <span className="insp__hint">
          {isRoot
            ? <>fork at <b className="tnum">{focusId}</b> · inject the fix · re-run → expect FAIL → PASS</>
            : <>fork at <b className="tnum">{focusId}</b> · re-run → expect no change (not the cause)</>}
        </span>
      </div>

      {replayResult && <ReplayOutcome result={replayResult} agent={node.label} output={step.output} />}
    </div>
  )
}
