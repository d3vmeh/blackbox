import type { FieldDiff, StepRole } from './deriveStepInsight'
import './SplitCompare.css'

const ROLE_LABEL: Record<StepRole, string> = {
  root: 'Root cause',
  blast: 'Blast radius',
  decoy: 'Decoy suspect',
  symptom: 'Symptom',
  clean: 'Clean',
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
  return (
    <section className="split" aria-label="Problem and solution">
      <header className="split__hd">
        <div className="split__agent">
          <span className="split__agent-label">{agentLabel}</span>
          <span className="split__agent-role">{agentRole}</span>
        </div>
        <span className="split__role" data-role={role}>{ROLE_LABEL[role]}</span>
      </header>

      <p className="split__headline">{headline}</p>

      <div className="split__panes">
        <div className="split__pane split__pane--bad">
          <span className="split__pane-label">What happened</span>
          {diffs.length > 0 ? (
            <dl className="split__diffs">
              {diffs.map((d) => (
                <div key={d.key} className="split__diff">
                  <dt className="split__key">{d.key}</dt>
                  <dd className="split__val split__val--bad tnum">{d.bad}</dd>
                </div>
              ))}
            </dl>
          ) : (
            <p className="split__note">{problemNote}</p>
          )}
          {diffs.length > 0 && <p className="split__note split__note--sub">{problemNote}</p>}
        </div>

        <div className="split__pane split__pane--good">
          <span className="split__pane-label">The fix</span>
          {diffs.length > 0 ? (
            <dl className="split__diffs">
              {diffs.map((d) => (
                <div key={d.key} className="split__diff">
                  <dt className="split__key">{d.key}</dt>
                  <dd className="split__val split__val--good tnum">{d.good}</dd>
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
