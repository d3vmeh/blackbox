import type { Attribution, Step } from '../../types'
import '../dashboard.css'

export interface LogLine { t: string; level: string; src: string; msg: string; stepId: string }

const LEVEL: Record<Step['kind'], string> = {
  reason: 'INFO', tool_call: 'TOOL', tool_result: 'TOOL', decision: 'DEC', final: 'FIN',
}

function clock(index: number): string {
  const secs = index * 0.3
  return `+${secs.toFixed(1)}s`
}

function msgFor(step: Step): string {
  const o = step.output
  const s = typeof o === 'string' ? o : JSON.stringify(o)
  return s.length > 80 ? `${s.slice(0, 79)}…` : s
}

export function buildLog(steps: Step[]): LogLine[] {
  return steps.map((s) => ({
    t: clock(s.index),
    level: LEVEL[s.kind],
    src: s.tool_name ?? (typeof s.raw.span === 'string' ? s.raw.span : s.kind),
    msg: msgFor(s),
    stepId: s.id,
  }))
}

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
