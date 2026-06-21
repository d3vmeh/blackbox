import { agentOf } from '../../types'
import type { Attribution, Step } from '../../types'
import type { ActionNode } from '../types'
import { ProvenanceList, RawPayload, Section } from './sections'
import type { ParentLink } from './sections'
import '../dashboard.css'
import './Inspector.css'

export function Inspector({ node, steps, attribution, onReplay, nodes, onSelect }: {
  node: ActionNode | null
  steps: Step[]
  attribution: Attribution
  onReplay: (stepId: string) => void
  /** all action nodes — used to resolve a cross-agent parent's owning node for the jump */
  nodes?: ActionNode[]
  /** jump to another action node (e.g. a cross-agent producer) by node id */
  onSelect?: (nodeId: string) => void
}) {
  if (!node) {
    return <div className="insp insp--empty">Select a node to inspect its telemetry.</div>
  }
  const byId = new Map(steps.map((s) => [s.id, s]))
  const focusId = node.stepIds[node.stepIds.length - 1] // the result step
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

      <Section title="output">
        <RawPayload value={step.output} tone={isRoot || isBlast ? 'bad' : undefined} />
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

      {isRoot && (
        <Section title="why it's the root cause">
          <p className="insp__rationale">{attribution.rationale}</p>
        </Section>
      )}

      </div>
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
