import { AnimatePresence, motion } from 'motion/react'
import './dashboard.css'

export function ReadoutBar({ runId, task, verdict, meta }: {
  runId: string; task: string; verdict: 'FAIL' | 'PASS'; meta: string
}) {
  return (
    <header className="rb">
      <span className="rb__mark" aria-hidden="true">
        {/* instrument mark: a half-lit recorder eye */}
        <svg viewBox="0 0 16 16"><circle cx="8" cy="8" r="6.5" /><path d="M8 1.5 A6.5 6.5 0 0 1 8 14.5 Z" /></svg>
      </span>
      <span className="rb__brand">blackbox</span>
      <span className="rb__sep" aria-hidden="true" />
      <span className="rb__id tnum">{runId}</span>
      <span className="rb__task">{task}</span>
      <span className="rb__meta">{meta}</span>
      <span className="rb__spacer" />
      <span className="rb__eyebrow">oracle</span>
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
    </header>
  )
}
