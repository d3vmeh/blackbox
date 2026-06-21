import { AnimatePresence, motion } from 'motion/react'
import './dashboard.css'

export function ReadoutBar({ runId, task, verdict, meta }: {
  runId: string; task: string; verdict: 'FAIL' | 'PASS'; meta: string
}) {
  return (
    <div className="rb">
      <span className="rb__id"><b>{runId}</b> · {task}</span>
      <span className="rb__meta">{meta}</span>
      <span className="rb__spacer" />
      <span className="rb__eyebrow">oracle</span>
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
    </div>
  )
}
