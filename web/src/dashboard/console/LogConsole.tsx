import type { Attribution, Step } from '../../types'
import { buildLog } from './buildLog'
import '../dashboard.css'

export function LogConsole({ steps, attribution, selectedStepId }: {
  steps: Step[]
  attribution: Attribution
  selectedStepId: string | null
}) {
  const lines = buildLog(steps)
  return (
    <div className="lc">
      <div className="lc__head">
        <span className="lc__tab lc__tab--on">Logs</span>
        <span className="lc__tab">Spans</span>
        <span className="lc__tab">State diff</span>
      </div>
      <div className="lc__lines">
        {lines.map((ln) => (
          <div
            key={ln.stepId}
            data-testid={`log-${ln.stepId}`}
            data-flag={ln.stepId === attribution.root_step_id ? 'root' : undefined}
            data-selected={ln.stepId === selectedStepId || undefined}
            className="lc__ln"
          >
            <span className="lc__t">{ln.t}</span>
            <span className="lc__lv">{ln.level}</span>
            <span className="lc__src">{ln.src}</span>
            <span className="lc__msg">{ln.msg}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
