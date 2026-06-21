import type { FieldDiff, StepRole } from './deriveStepInsight'
import './SplitCompare.css'

const ROLE_LABEL: Record<StepRole, string> = {
  root: 'Root cause',
  blast: 'Blast radius',
  decoy: 'Decoy suspect',
  symptom: 'Symptom',
  clean: 'Clean',
}

// Semantic color is reserved: red = fault localized here, green = fix applied here.
// Only root/blast earn the full problem→fix framing. The rest read neutral so a
// clean or decoy step never looks like it has a problem and a proposed fix.
type PaneTone = 'bad' | 'good' | 'neutral'

interface PaneConfig {
  /** left pane: what the step produced / what went wrong */
  badLabel: string
  badTone: PaneTone
  /** right pane: the fix, or where the fix actually lives */
  goodLabel: string
  goodTone: PaneTone
}

const PANE_CONFIG: Record<StepRole, PaneConfig> = {
  root: { badLabel: 'What happened', badTone: 'bad', goodLabel: 'The fix', goodTone: 'good' },
  blast: { badLabel: 'What happened', badTone: 'bad', goodLabel: 'The fix', goodTone: 'good' },
  // The failure surfaces here, but the fix is upstream — keep red on the left,
  // neutral on the right so it never implies the fix lands at this step.
  symptom: { badLabel: 'What happened', badTone: 'bad', goodLabel: 'Where the fix is', goodTone: 'neutral' },
  // A plausible suspect that replay clears — no fault, no fix here.
  decoy: { badLabel: 'Under suspicion', badTone: 'neutral', goodLabel: 'Replay verdict', goodTone: 'neutral' },
  // No fault and no fix localized here — purely a neutral readout.
  clean: { badLabel: 'Output', badTone: 'neutral', goodLabel: 'Status', goodTone: 'neutral' },
}

export function SplitCompare({
  role,
  agentLabel,
  agentRole,
  headline,
  diffs,
  problemNote,
  solutionNote,
}: {
  role: StepRole
  agentLabel: string
  agentRole: string
  headline: string
  diffs: FieldDiff[]
  problemNote: string
  solutionNote: string
}) {
  const cfg = PANE_CONFIG[role]
  return (
    <section className="split" aria-label="Step readout">
      <header className="split__hd">
        <div className="split__agent">
          <span className="split__agent-label">{agentLabel}</span>
          <span className="split__agent-role">{agentRole}</span>
        </div>
        <span className="split__role" data-role={role}>{ROLE_LABEL[role]}</span>
      </header>

      <p className="split__headline">{headline}</p>

      <div className="split__panes">
        <div className={`split__pane split__pane--${cfg.badTone}`}>
          <span className="split__pane-label">{cfg.badLabel}</span>
          {diffs.length > 0 ? (
            <dl className="split__diffs">
              {diffs.map((d) => (
                <div key={d.key} className="split__diff">
                  <dt className="split__key">{d.key}</dt>
                  <dd className={`split__val split__val--${cfg.badTone} tnum`}>{d.bad}</dd>
                </div>
              ))}
            </dl>
          ) : (
            <p className="split__note">{problemNote}</p>
          )}
          {diffs.length > 0 && <p className="split__note split__note--sub">{problemNote}</p>}
        </div>

        <div className={`split__pane split__pane--${cfg.goodTone}`}>
          <span className="split__pane-label">{cfg.goodLabel}</span>
          {diffs.length > 0 ? (
            <dl className="split__diffs">
              {diffs.map((d) => (
                <div key={d.key} className="split__diff">
                  <dt className="split__key">{d.key}</dt>
                  <dd className={`split__val split__val--${cfg.goodTone} tnum`}>{d.good}</dd>
                </div>
              ))}
            </dl>
          ) : (
            <p className="split__note">{solutionNote}</p>
          )}
          {diffs.length > 0 && <p className="split__note split__note--sub">{solutionNote}</p>}
        </div>
      </div>
    </section>
  )
}
