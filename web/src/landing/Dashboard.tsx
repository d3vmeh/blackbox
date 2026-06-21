import { useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import {
  DEMO_TRACE,
  PHASE_STATUS,
  ROOT_INDEX,
  BLAST_END,
  delayFor,
  statusFor,
  type DemoStep,
  type Phase,
} from './trace'
import './dashboard.css'

const KIND_TAG: Record<DemoStep['kind'], string> = {
  reason: 'RSN',
  tool_call: 'CALL',
  tool_result: 'RES',
  decision: 'DEC',
  final: 'FIN',
}

/** Plays once when scrolled into view, then rests on the confirmed (PASS) state. */
const CYCLE: { phase: Phase; hold: number }[] = [
  { phase: 'idle', hold: 1400 },
  { phase: 'blast', hold: 2800 },
  { phase: 'analyze', hold: 1900 },
  { phase: 'confirm', hold: 0 },
]
const LAST_BEAT = CYCLE.length - 1

const STAGGER_MS = 75
const BLAST_COUNT = BLAST_END - ROOT_INDEX

const RECENT_RUNS = [
  { id: 'claim_run', task: 'claims-adjudication', state: 'active' },
  { id: 'run_3f81', task: 'support-triage', state: 'pass' },
  { id: 'run_3f77', task: 'sql-writer', state: 'pass' },
  { id: 'run_3f60', task: 'web-shopper', state: 'pass' },
] as const

interface Field {
  label: string
  value: string
  tone?: 'root' | 'blast' | 'pass'
}

function inspectorFields(phase: Phase): Field[] {
  switch (phase) {
    case 'idle':
      return [
        { label: 'oracle', value: 'FAIL', tone: 'blast' },
        { label: 'reason', value: 'payout $42,000 exceeds policy limit for claim' },
      ]
    case 'blast':
      return [
        { label: 'symptom', value: 'wrong payout amount at PAYOUT agent' },
        { label: 'blast radius', value: `${BLAST_COUNT} agents · COVERAGE → PAYOUT`, tone: 'blast' },
      ]
    case 'analyze':
      return [
        { label: 'hand-off', value: 'amount: $42,000 (should be $4,200)' },
        { label: 'root cause', value: 'INTAKE decimal slip on billed amount', tone: 'root' },
      ]
    case 'confirm':
      return [
        { label: 'fix', value: 'inject amount = 4200.0 at INTAKE', tone: 'pass' },
        { label: 'replay', value: 'n = 5 re-runs' },
        { label: 'confirmation', value: '5 / 5 passed', tone: 'pass' },
      ]
  }
}

export function Dashboard() {
  const [beat, setBeat] = useState(0)
  const [started, setStarted] = useState(false)
  const reduce = useReducedMotion()
  const rootRef = useRef<HTMLDivElement>(null)
  const phase = CYCLE[reduce ? LAST_BEAT : beat].phase

  useEffect(() => {
    const el = rootRef.current
    if (!el) return
    const io = new IntersectionObserver(
      ([e]) => {
        if (e.isIntersecting) {
          setStarted(true)
          io.disconnect()
        }
      },
      { threshold: 0.2, rootMargin: '0px 0px -10% 0px' },
    )
    io.observe(el)
    return () => io.disconnect()
  }, [])

  useEffect(() => {
    if (!started || reduce || beat >= LAST_BEAT) return
    const id = window.setTimeout(() => setBeat((b) => b + 1), CYCLE[beat].hold)
    return () => window.clearTimeout(id)
  }, [started, beat, reduce])

  const replay = () => setBeat(0)
  const verdict = phase === 'confirm' ? 'PASS' : 'FAIL'
  const analyzing = phase === 'analyze'
  const rootStep = DEMO_TRACE[ROOT_INDEX]

  return (
    <div className="appshell" ref={rootRef}>
      <aside className="appshell__side">
        <div className="appshell__brand">
          <span className="appshell__mark" aria-hidden="true" />
          blackbox
        </div>
        <nav className="appshell__nav">
          <span className="appshell__navitem appshell__navitem--on">Runs</span>
          <span className="appshell__navitem">Traces</span>
          <span className="appshell__navitem">Evals</span>
          <span className="appshell__navitem">Replays</span>
        </nav>
        <p className="eyebrow appshell__sectlabel">Recent runs</p>
        <ul className="appshell__runs">
          {RECENT_RUNS.map((r) => (
            <li key={r.id} className={`appshell__run${r.state === 'active' ? ' appshell__run--on' : ''}`}>
              <span
                className={`appshell__rundot appshell__rundot--${
                  r.state === 'active' ? (phase === 'confirm' ? 'pass' : 'fail') : 'pass'
                }`}
              />
              <span className="appshell__runid tnum">{r.id}</span>
              <span className="appshell__runtask">{r.task}</span>
            </li>
          ))}
        </ul>
      </aside>

      <main className="appshell__main">
        <header className="appshell__head">
          <div className="appshell__headid">
            <span className="eyebrow">trace</span>
            <span className="appshell__run-title tnum">claim_run · claims-adjudication · multi-agent</span>
          </div>
          <div className="appshell__verdict">
            <span className="appshell__status">{PHASE_STATUS[phase]}</span>
            <AnimatePresence mode="popLayout" initial={false}>
              <motion.span
                key={verdict}
                className={`verdict verdict--${verdict.toLowerCase()}`}
                initial={{ y: 8, opacity: 0, scale: 0.8 }}
                animate={{ y: 0, opacity: 1, scale: 1 }}
                exit={{ y: -8, opacity: 0, scale: 0.9 }}
                transition={{ type: 'spring', stiffness: 600, damping: 30, mass: 0.8 }}
              >
                {verdict}
              </motion.span>
            </AnimatePresence>
          </div>
        </header>

        <ol className={`spine${analyzing ? ' spine--analyzing' : ''}`}>
          {DEMO_TRACE.map((step, i) => {
            const st = statusFor(i, phase)
            const delay = delayFor(i, phase, STAGGER_MS)
            return (
              <li key={step.id} className={`step step--${st}`}>
                <span className="step__edge" style={{ transitionDelay: `${delay}ms` }} />
                <span className="step__idx tnum">{String(i).padStart(2, '0')}</span>
                <span className="step__kind">{KIND_TAG[step.kind]}</span>
                <span className="step__label">{step.label}</span>
                <span className="step__marker" style={{ transitionDelay: `${delay}ms` }}>
                  {st === 'root' && 'ROOT CAUSE'}
                  {st === 'blast' && '↓ poisoned'}
                  {st === 'pass' && '✓ healed'}
                </span>
              </li>
            )
          })}
        </ol>

        <footer className="appshell__foot">
          <span className="kbd">j</span>
          <span className="kbd">k</span>
          <span className="appshell__hint">step</span>
          <span className="kbd">↵</span>
          <span className="appshell__hint">inspect</span>
          <span className="appshell__foot-spacer" />
          <button className="appshell__replaybtn" type="button" onClick={replay}>↻ replay</button>
        </footer>
      </main>

      <aside className="appshell__inspect">
        <div className="appshell__inspect-head">
          <span className="eyebrow">inspector</span>
          {phase !== 'idle' && (
            <span className="appshell__pill tnum">{rootStep.id} · {rootStep.kind}</span>
          )}
        </div>

        <AnimatePresence mode="wait">
          <motion.div
            key={phase}
            className="appshell__inspect-body"
            initial={{ opacity: 0, x: 8 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -8 }}
            transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
          >
            {inspectorFields(phase).map((f, idx) => (
              <motion.div
                key={f.label}
                className="field"
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.05 * idx, duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
              >
                <span className="field__label">{f.label}</span>
                <span className={`field__value tnum${f.tone ? ` field__value--${f.tone}` : ''}`}>
                  {f.value}
                </span>
              </motion.div>
            ))}
          </motion.div>
        </AnimatePresence>

        <div className="appshell__replay">
          {phase === 'confirm' ? '✓ Fix confirmed' : 'Replay with fix'}
        </div>
      </aside>
    </div>
  )
}
