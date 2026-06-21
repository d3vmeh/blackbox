import { ArrowUpRight } from 'lucide-react'
import type { Json } from '../../types'

/** One resolved parent of the selected step, ready to render in the provenance list. */
export interface ParentLink {
  /** the parent Step.id (e.g. "s5") */
  stepId: string
  /** owning-agent label of the parent, or null when single-agent / untagged */
  agentLabel: string | null
  /** true when the parent belongs to a DIFFERENT agent than the selected step */
  crossAgent: boolean
  /** action-node id that contains this parent step (for the jump), if resolvable */
  nodeId: string | null
}

export function Section({ title, aside, children }: {
  title: string; aside?: string; children: React.ReactNode
}) {
  return (
    <div className="insp__sec">
      <div className="insp__sech"><span>{title}</span>{aside && <span>{aside}</span>}</div>
      {children}
    </div>
  )
}

export function Field({ k, v, tone }: { k: string; v: React.ReactNode; tone?: 'bad' | 'good' | 'root' }) {
  return (
    <div className="insp__kv">
      <span className="insp__k">{k}</span>
      <span className={`insp__v${tone ? ` insp__v--${tone}` : ''}`}>{v}</span>
    </div>
  )
}

export function RawPayload({ value, tone }: { value: Json; tone?: 'bad' }) {
  return (
    <pre className={`insp__pre${tone === 'bad' ? ' insp__pre--bad' : ''}`}>
      {JSON.stringify(value, null, 2)}
    </pre>
  )
}

/**
 * The provenance list for the selected step. Same-agent (or untagged) parents
 * recede as quiet rows; a parent owned by a DIFFERENT agent is rendered with the
 * producing agent's label and is clickable to jump there (cross-agent provenance).
 * Icons are NEUTRAL affordance only — the agent is carried by POSITION + LABEL.
 */
export function ProvenanceList({ parents, onJump }: {
  parents: ParentLink[]
  onJump?: (nodeId: string) => void
}) {
  if (parents.length === 0) {
    return <div className="insp__provrow"><span className="insp__provdash">—</span></div>
  }
  return (
    <div className="insp__prov">
      {parents.map((p) => {
        const canJump = p.crossAgent && p.nodeId != null && onJump != null
        if (canJump) {
          const nodeId = p.nodeId as string
          return (
            <button
              key={p.stepId}
              type="button"
              className="insp__provlink"
              onClick={() => onJump?.(nodeId)}
              title={`Jump to ${p.stepId}${p.agentLabel ? ` · ${p.agentLabel}` : ''}`}
            >
              <ArrowUpRight className="insp__provicon" size={16} strokeWidth={1.5} aria-hidden />
              <span className="insp__provid tnum">{p.stepId}</span>
              {p.agentLabel && <span className="insp__provagent">{p.agentLabel}</span>}
            </button>
          )
        }
        return (
          <div key={p.stepId} className="insp__provrow">
            <span className="insp__provid tnum">{p.stepId}</span>
            {p.agentLabel && <span className="insp__provagent">{p.agentLabel}</span>}
          </div>
        )
      })}
    </div>
  )
}
