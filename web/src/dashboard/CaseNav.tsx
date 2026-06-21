// web/src/dashboard/CaseNav.tsx
// Left rail = the navigation analog (Linear's nav · workspace · favorites), reframed as a
// forensic case file: run identity → the debug pipeline as a status-glyph stepper →
// ranked suspects (candidates) you can jump to. Drives the WHERE, the spine shows it.
import type { Attribution, Trace } from '../types'
import type { ActionGraph } from './types'
import { Glyph, type GlyphState } from './Glyph'
import type { Phase } from './phase'
import './dashboard.css'

const PIPELINE: { key: string; label: string; note: string }[] = [
  { key: 'record', label: 'Record', note: 'trace captured' },
  { key: 'blast', label: 'Blast radius', note: 'forward slice' },
  { key: 'analyze', label: 'Localize', note: 'rank suspects' },
  { key: 'confirm', label: 'Confirm', note: 'fork · inject · replay' },
]

// How far the pipeline has advanced for a given phase (index into PIPELINE that is "active").
const PHASE_REACH: Record<Phase, number> = {
  idle: 0, blast: 1, analyze: 2, rejected: 2, confirm: 3,
}

function stepState(stepIdx: number, phase: Phase): GlyphState {
  const reach = PHASE_REACH[phase]
  if (phase === 'confirm') return 'done'
  if (stepIdx < reach) return 'done'
  if (stepIdx === reach) return 'active'
  return 'pending'
}

export function CaseNav({ trace, attribution, graph, phase, selectedId, onSelect }: {
  trace: Trace
  attribution: Attribution
  graph: ActionGraph
  phase: Phase
  selectedId: string | null
  onSelect: (nodeId: string) => void
}) {
  const nodeForStep = (stepId: string) =>
    graph.nodes.find((n) => n.stepIds.includes(stepId))?.id ?? null
  // Suspects only become a verdict once localization has run; until then they're latent.
  const localized = phase === 'analyze' || phase === 'rejected' || phase === 'confirm'

  return (
    <nav className="nav" aria-label="Case navigator">
      <section className="nav__sec">
        <div className="nav__id">
          <span className="nav__idk">trace</span>
          <span className="nav__idv tnum">{trace.id}</span>
        </div>
        <p className="nav__obj">{trace.task}</p>
      </section>

      <section className="nav__sec">
        <h2 className="nav__head">Pipeline</h2>
        <ol className="pipe">
          {PIPELINE.map((p, i) => {
            const st = stepState(i, phase)
            return (
              <li key={p.key} className="pipe__step" data-state={st}>
                <Glyph state={st} tone={p.key === 'confirm' && st === 'done' ? 'pass' : 'neutral'} />
                <span className="pipe__label">{p.label}</span>
                <span className="pipe__note">{p.note}</span>
              </li>
            )
          })}
        </ol>
      </section>

      <section className="nav__sec nav__sec--grow">
        <h2 className="nav__head">
          Suspects <span className="nav__count tnum">{attribution.candidates.length}</span>
        </h2>
        <ul className="susp">
          {attribution.candidates.map((c, i) => {
            const nodeId = nodeForStep(c.step_id)
            const isLead = i === 0
            const selected = nodeId != null && nodeId === selectedId
            // The leading suspect IS the localized root → it earns --root once localized.
            const tone = isLead && localized ? 'root' : 'neutral'
            const glyph: GlyphState = isLead && localized ? 'done' : 'pending'
            return (
              <li key={c.step_id}>
                <button
                  type="button"
                  className="susp__row"
                  data-lead={isLead || undefined}
                  data-selected={selected || undefined}
                  disabled={nodeId == null}
                  onClick={() => nodeId && onSelect(nodeId)}
                >
                  <Glyph state={glyph} tone={tone} />
                  <span className="susp__id tnum">{c.step_id}</span>
                  <span className="susp__reason">{c.reason}</span>
                  <span className="susp__meter" aria-hidden="true">
                    <span className="susp__fill" data-tone={tone} style={{ width: `${Math.round(c.suspicion * 100)}%` }} />
                  </span>
                  <span className="susp__score tnum" data-tone={tone}>{c.suspicion.toFixed(2)}</span>
                </button>
              </li>
            )
          })}
        </ul>
      </section>

      <section className="nav__sec nav__keys">
        <span className="kbd">j</span><span className="kbd">k</span>
        <span className="nav__keysl">move</span>
        <span className="kbd">↵</span><span className="nav__keysl">inspect</span>
        <span className="kbd">r</span><span className="nav__keysl">replay</span>
      </section>
    </nav>
  )
}
