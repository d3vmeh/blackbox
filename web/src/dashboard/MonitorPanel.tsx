// web/src/dashboard/MonitorPanel.tsx
// The popped-out floating monitor card (--raised, --r-4, --line-hi top edge,
// --shadow-pop), bottom-right OVER the spine. Shows the monitor's live
// play-by-play (mono rows) + an inline trust line.
//
// Tone rules (DESIGN.md closed set):
//   · 'neutral'  ordinary readout            → --text
//   · 'reject'   decoy rejected · NO flip     → --text-dim (NEVER a signal hue)
//   · 'pass'     confirmed fix                → --pass (the lone signal allowed)
// The trust line is rendered inline (not the shared TrustBadge) to avoid a
// cross-file race; it obeys the same token rules — only `trusted` earns --pass.
//
// Enter --ease-out (scale + opacity), exit --ease-in. Under prefers-reduced-
// motion the panel appears/disappears at its final state, with identical colors.
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { Activity, X } from 'lucide-react'
import type { TrustState } from './types'
import './MonitorPanel.css'

export type MonitorLineTone = 'neutral' | 'reject' | 'pass'

export interface MonitorLine {
  text: string
  tone?: MonitorLineTone
}

export interface MonitorPanelProps {
  open: boolean
  lines: MonitorLine[]
  trust: TrustState
  /** Dismiss the panel. When omitted, no close affordance is shown. */
  onClose?: () => void
}

const TRUST_LABEL: Record<TrustState, string> = {
  untrusted: 'untrusted',
  proving: 'proving…',
  trusted: 'trusted',
}

const SPRING = { type: 'spring', stiffness: 360, damping: 34, mass: 1 } as const

export function MonitorPanel({ open, lines, trust, onClose }: MonitorPanelProps) {
  const reduce = useReducedMotion()

  // Reduced motion → no scale/translate; just toggle final state.
  const enter = reduce
    ? { initial: { opacity: 1 }, animate: { opacity: 1 }, exit: { opacity: 1 } }
    : {
        initial: { opacity: 0, scale: 0.94, y: 8 },
        animate: { opacity: 1, scale: 1, y: 0 },
        exit: { opacity: 0, scale: 0.96, y: 6 },
      }

  return (
    <AnimatePresence>
      {open && (
        <motion.aside
          className="mon"
          role="status"
          aria-live="polite"
          data-testid="monitor-panel"
          initial={enter.initial}
          animate={enter.animate}
          exit={enter.exit}
          transition={reduce ? { duration: 0 } : SPRING}
        >
          <header className="mon__hd">
            <Activity className="mon__icon" aria-hidden="true" />
            <span className="mon__eyebrow">monitor</span>
            {onClose && (
              <button type="button" className="mon__close" onClick={onClose} aria-label="Close monitor">
                <X className="mon__close-icon" aria-hidden="true" />
              </button>
            )}
          </header>

          <ol className="mon__log">
            {lines.map((line, i) => (
              <li
                key={`${i}-${line.text}`}
                className="mon__line"
                data-tone={line.tone ?? 'neutral'}
              >
                {line.text}
              </li>
            ))}
          </ol>

          <div className="mon__trust" data-trust={trust}>
            <span className="mon__trust-dot" aria-hidden="true" />
            <span className="mon__trust-label">{TRUST_LABEL[trust]}</span>
          </div>
        </motion.aside>
      )}
    </AnimatePresence>
  )
}
