import { AnimatePresence, motion } from 'motion/react'
import { BarChart3 } from 'lucide-react'
import { TrustBadge } from './TrustBadge'
import type { TrustState } from './types'
import './dashboard.css'
import './ReadoutBar.css'

export function ReadoutBar({ runId, task, verdict, meta, trust = 'untrusted', rate, n, statsOpen = false, onToggleStats, runtime, monitorDecision }: {
  runId: string; task: string; verdict: 'FAIL' | 'PASS' | 'READY'; meta: string
  trust?: TrustState; rate?: number; n?: number
  statsOpen?: boolean; onToggleStats?: () => void
  runtime?: string
  monitorDecision?: 'auto_apply' | 'escalate' | null
}) {
  // FAIL/READY mean the pipeline is still working; PASS = settled. The live dot
  // pulses only while unsettled so the phase status reads as "in progress".
  const settled = verdict === 'PASS'
  return (
    <header className="rb">
      {/* Left: run identity — id · task · domain, tight so it reads as one subject line */}
      <span className="rb__id tnum" title={runId}>{runId}</span>
      <span className="rb__task" title={task}>{task}</span>
      {runtime && <span className="rb__runtime">{runtime.replace(/-/g, ' ')}</span>}
      <span className="rb__spacer" />
      {/* Right: one cohesive status cluster — live phase → oracle verdict, hairline-grouped */}
      <div className="rb__status">
        <span className="rb__phase" data-settled={settled || undefined}>
          <span className="rb__phase-dot" aria-hidden="true" />
          {meta}
        </span>
        {monitorDecision === 'auto_apply' && (
          <span className="rb__trust rb__trust--apply">auto-apply</span>
        )}
        {monitorDecision === 'escalate' && (
          <span className="rb__trust rb__trust--escalate">escalate</span>
        )}
        {onToggleStats && (
          <button
            type="button"
            className="rb__stats"
            data-active={statsOpen || undefined}
            aria-pressed={statsOpen}
            aria-label="Toggle run statistics"
            title="Statistics (s)"
            onClick={onToggleStats}
          >
            <BarChart3 size={16} strokeWidth={1.5} aria-hidden="true" />
            <span className="rb__stats-key">s</span>
          </button>
        )}
        <span className="rb__div" aria-hidden="true" />
        <span className="rb__eyebrow">oracle</span>
        {/* TrustBadge + verdict read as one focal cluster, badge immediately left of the verdict word */}
        <span className="rb__readout">
          <TrustBadge state={trust} rate={rate} n={n} />
          <span className="rb__verdict-slot">
            <AnimatePresence mode="popLayout" initial={false}>
              <motion.span
                key={verdict}
                className={`rb__verdict rb__verdict--${verdict.toLowerCase()}`}
                initial={{ y: 8, opacity: 0, scale: 0.85 }}
                animate={{ y: 0, opacity: 1, scale: 1 }}
                exit={{ y: -8, opacity: 0, scale: 0.9 }}
                transition={{ type: 'spring', stiffness: 360, damping: 34, mass: 1 }}
              >
                {verdict}
              </motion.span>
            </AnimatePresence>
          </span>
        </span>
      </div>
    </header>
  )
}
