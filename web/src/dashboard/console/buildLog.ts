import type { Step } from '../../types'

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
