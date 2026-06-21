import type { Step } from '../../types'

// `msg` is the collapsed one-line preview (clipped); `full` is the complete
// payload, revealed when a row is expanded so the readout stays inspectable.
export interface LogLine { t: string; level: string; kind: Step['kind']; src: string; msg: string; full: string; stepId: string }

const LEVEL: Record<Step['kind'], string> = {
  reason: 'INFO', tool_call: 'TOOL', tool_result: 'TOOL', decision: 'DEC', final: 'FIN',
  handoff: 'HOFF',
}

function clock(index: number): string {
  const secs = index * 0.3
  return `+${secs.toFixed(1)}s`
}

// The full payload, formatted for the expanded view: objects pretty-printed so
// the JSON is readable when wrapped, strings passed through verbatim.
function fullFor(step: Step): string {
  const o = step.output
  return typeof o === 'string' ? o : JSON.stringify(o, null, 2)
}

// One-line preview for the collapsed row (the CSS still ellipsis-clips it).
function msgFor(full: string): string {
  const oneLine = full.replace(/\s+/g, ' ')
  return oneLine.length > 80 ? `${oneLine.slice(0, 79)}…` : oneLine
}

export function buildLog(steps: Step[]): LogLine[] {
  return steps.map((s) => {
    const full = fullFor(s)
    return {
      t: clock(s.index),
      level: LEVEL[s.kind],
      kind: s.kind,
      src: s.tool_name ?? (typeof s.raw.span === 'string' ? s.raw.span : s.kind),
      msg: msgFor(full),
      full,
      stepId: s.id,
    }
  })
}
