import { useState } from 'react'
import { ChevronDown } from 'lucide-react'
import type { Attribution, Step } from '../../types'
import { buildLog } from './buildLog'
import '../dashboard.css'

export function LogConsole({ steps, attribution, selectedStepId, sourceByStep }: {
  steps: Step[]
  attribution: Attribution
  selectedStepId: string | null
  // stepId → the emitting agent/action label (from the trace graph), so the SOURCE
  // column says WHO produced the line instead of repeating the KIND.
  sourceByStep?: Record<string, string>
}) {
  // Collapsible: the chronological readout duplicates the spine, so it doesn't
  // always need to occupy vertical space. Header stays as a thin dock when closed.
  const [open, setOpen] = useState(true)
  // Per-row expansion: collapsed rows stay scannable (one ellipsis-clipped line),
  // and clicking a row reveals its full OUTPUT payload wrapped below the columns.
  const [expanded, setExpanded] = useState<ReadonlySet<string>>(() => new Set())
  const toggleRow = (stepId: string) =>
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(stepId)) next.delete(stepId)
      else next.add(stepId)
      return next
    })
  const lines = buildLog(steps)
  const rootMarked = lines.some((ln) => ln.stepId === attribution.root_step_id)
  return (
    <div className="lc" data-open={open || undefined}>
      <button
        type="button"
        className="lc__head"
        aria-expanded={open}
        aria-label={open ? 'Collapse log dock' : 'Expand log dock'}
        onClick={() => setOpen((o) => !o)}
      >
        <ChevronDown className="lc__chev" size={14} strokeWidth={1.5} aria-hidden="true" />
        <span className="lc__eyebrow">Log dock</span>
        <span className="lc__sub">
          chronological readout{rootMarked ? ' · root line marked' : ''}
        </span>
        <span className="lc__count tnum">{lines.length} lines</span>
      </button>
      {open && (
        <div className="lc__body">
          <div className="lc__cols" aria-hidden="true">
            <span>t</span>
            <span>step</span>
            <span>source</span>
            <span>kind</span>
            <span>output</span>
          </div>
          <div className="lc__lines" role="log">
            {lines.map((ln) => {
              const isExpanded = expanded.has(ln.stepId)
              return (
                <div
                  key={ln.stepId}
                  data-testid={`log-${ln.stepId}`}
                  data-flag={ln.stepId === attribution.root_step_id ? 'root' : undefined}
                  data-selected={ln.stepId === selectedStepId || undefined}
                  className="lc__ln"
                >
                  {/* The row itself is the toggle — click anywhere to reveal the
                      full OUTPUT. It's a real button so it's keyboard-reachable. */}
                  <button
                    type="button"
                    className="lc__row"
                    aria-expanded={isExpanded}
                    aria-label={isExpanded ? 'Collapse line output' : 'Expand line output'}
                    onClick={() => toggleRow(ln.stepId)}
                  >
                    <span className="lc__t">{ln.t}</span>
                    <span className="lc__step">{ln.stepId}</span>
                    <span className="lc__src">{sourceByStep?.[ln.stepId] ?? ln.src}</span>
                    <span className="lc__lv" data-kind={ln.kind}>{ln.level}</span>
                    <span className="lc__msg">{ln.msg}</span>
                  </button>
                  {isExpanded && <pre className="lc__full">{ln.full}</pre>}
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
