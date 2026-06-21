// web/src/dashboard/StatsOverlay.tsx
// Full-width usage-statistics overlay over the work area (--z-overlay, the same
// layer family as the confirm replay). A neutral instrument readout: aggregate
// stat tiles across all agents on top, a per-agent breakdown table below.
//
// NO signal hue here. --root/--blast/--pass stay reserved for the trace; every
// surface, text tier and number on this panel is neutral. Agents are told apart
// by position + label only, never a per-agent color (DESIGN.md closed set).
//
// TOKENS ARE ESTIMATED (~chars/4 — the backend does not stream usage yet). The
// header carries a standing "est." badge so the figures are never read as exact.
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { BarChart3, X } from 'lucide-react'
import type { RunStats } from './deriveStats'
import './StatsOverlay.css'

const SPRING = { type: 'spring', stiffness: 360, damping: 34, mass: 1 } as const

const fmt = (n: number) => n.toLocaleString('en-US')

export interface StatsOverlayProps {
  open: boolean
  stats: RunStats
  onClose: () => void
}

export function StatsOverlay({ open, stats, onClose }: StatsOverlayProps) {
  const reduce = useReducedMotion()
  const { agents, totals } = stats
  const maxTok = Math.max(1, ...agents.map((a) => a.tokensTotal))

  const enter = reduce
    ? { initial: { opacity: 1 }, animate: { opacity: 1 }, exit: { opacity: 1 } }
    : {
        initial: { opacity: 0, y: 8 },
        animate: { opacity: 1, y: 0 },
        exit: { opacity: 0, y: 6 },
      }

  const tiles: { label: string; value: string }[] = [
    { label: 'est. tokens', value: fmt(totals.tokensTotal) },
    { label: 'tool calls', value: fmt(totals.toolCalls) },
    { label: 'steps', value: fmt(totals.steps) },
    { label: 'agents', value: fmt(totals.agents) },
    { label: 'handoffs', value: fmt(totals.handoffs) },
    { label: 'avg prompt', value: `${fmt(totals.avgPromptLen)}c` },
  ]

  return (
    <AnimatePresence>
      {open && (
        <motion.section
          className="stats"
          role="dialog"
          aria-label="Run statistics"
          data-testid="stats-overlay"
          initial={enter.initial}
          animate={enter.animate}
          exit={enter.exit}
          transition={reduce ? { duration: 0 } : SPRING}
        >
          <header className="stats__hd">
            <BarChart3 className="stats__icon" size={16} strokeWidth={1.5} aria-hidden="true" />
            <span className="stats__eyebrow">Statistics · usage</span>
            <span className="stats__badge" title="token figures are estimated (~chars/4)">est.</span>
            <button type="button" className="stats__close" onClick={onClose} aria-label="Close statistics">
              <X size={14} strokeWidth={1.5} aria-hidden="true" />
            </button>
          </header>

          {/* Aggregate strip — totals across every agent */}
          <div className="stats__agg">
            {tiles.map((t) => (
              <div className="stats__tile" key={t.label}>
                <span className="stats__tile-val tnum">{t.value}</span>
                <span className="stats__tile-label">{t.label}</span>
              </div>
            ))}
          </div>

          {/* Per-agent breakdown */}
          <div className="stats__tablewrap">
            <table className="stats__table">
              <thead>
                <tr>
                  <th className="stats__th-agent">agent</th>
                  <th>steps</th>
                  <th>tools</th>
                  <th>tok in</th>
                  <th>tok out</th>
                  <th>tok total</th>
                  <th>avg prompt</th>
                  <th>avg output</th>
                  <th className="stats__th-share">token share</th>
                </tr>
              </thead>
              <tbody>
                {agents.map((a) => (
                  <tr key={a.label}>
                    <td className="stats__agent">{a.label}</td>
                    <td className="tnum">{fmt(a.steps)}</td>
                    <td className="tnum">{fmt(a.toolCalls)}</td>
                    <td className="tnum">{fmt(a.tokensIn)}</td>
                    <td className="tnum">{fmt(a.tokensOut)}</td>
                    <td className="tnum stats__strong">{fmt(a.tokensTotal)}</td>
                    <td className="tnum">{fmt(a.avgPromptLen)}c</td>
                    <td className="tnum">{fmt(a.avgOutputLen)}c</td>
                    <td className="stats__share">
                      <span className="stats__meter" aria-hidden="true">
                        <span
                          className="stats__fill"
                          style={{ width: `${Math.round((a.tokensTotal / maxTok) * 100)}%` }}
                        />
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </motion.section>
      )}
    </AnimatePresence>
  )
}
