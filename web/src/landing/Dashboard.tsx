// Landing-page showcase dashboard — a self-contained mockup that MIRRORS the real
// dashboard's layout (ReadoutBar · MonitorRail · Topology + provenance graph ·
// Inspector) on hand-authored fake data. It auto-plays the real beat machine
// (idle → blast → analyze → proving_decoy → proving_root → confirm) once scrolled
// into view, then rests on the confirmed PASS state.
//
// It reuses the real pure presentational pieces (ReadoutBar, Topology, Glyph,
// GraphNode) and the real phase/status helpers so the showcase can't drift; the
// rail / graph / inspector chrome is re-authored locally. No backend, no API.
import { useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { Crosshair, GitFork, Gavel, Users, Workflow } from 'lucide-react'
import { ReadoutBar } from '../dashboard/ReadoutBar'
import { Topology } from '../dashboard/Topology'
import { Glyph, type GlyphState, type GlyphTone } from '../dashboard/Glyph'
import { GraphNode } from '../dashboard/graph/GraphNode'
import { PHASE_STATUS, displayStatus, trustForPhase, type Phase } from '../dashboard/phase'
import {
  AGENTS, BANDS, BAND_SEPS, CANDIDATES, CYCLE, EDGES, FOCAL_PILL,
  GRAPH_H, GRAPH_W, LAST_BEAT, NODE_H, NODE_W, NODES, PHASE_REACH, REPLAY_N,
  RUN_ID, RUN_RUNTIME, RUN_TASK, SUPERVISE, TOPOLOGY,
  inspectorFields, type Field, type ShowcaseAgent, type ShowcaseCandidate,
} from './showcaseData'
import '../dashboard/MonitorRail.css'
import './dashboard.css'

const STAGGER_MS = 80

// ---- Phase predicates (mirror the real MonitorRail) -------------------------
function isLocalized(phase: Phase): boolean {
  return phase === 'analyze' || phase === 'proving_decoy' || phase === 'proving_root'
    || phase === 'rejected' || phase === 'confirm'
}

function stepperState(idx: number, phase: Phase): GlyphState {
  const reach = PHASE_REACH[phase]
  if (phase === 'confirm') return 'done'
  if (idx < reach) return 'done'
  if (idx === reach) return 'active'
  return 'pending'
}

function agentGlyph(agent: ShowcaseAgent, phase: Phase): { state: GlyphState; tone: GlyphTone } {
  if (!isLocalized(phase)) return { state: 'pending', tone: 'neutral' }
  if (agent.status === 'root') return { state: 'done', tone: 'root' }
  return { state: 'done', tone: 'neutral' }
}

// ---- Candidate inline replay verdict ----------------------------------------
type Verdict =
  | { kind: 'latent' }
  | { kind: 'flip'; passed: number; confirmed: boolean }
  | { kind: 'reject' }

function candidateVerdict(c: ShowcaseCandidate, phase: Phase): Verdict {
  if (c.kind === 'root') {
    if (phase === 'confirm') return { kind: 'flip', passed: REPLAY_N, confirmed: true }
    if (phase === 'proving_root') return { kind: 'flip', passed: 0, confirmed: false }
    return { kind: 'latent' }
  }
  if (c.kind === 'decoy') {
    if (phase === 'proving_decoy' || phase === 'proving_root' || phase === 'confirm' || phase === 'rejected') {
      return { kind: 'reject' }
    }
    return { kind: 'latent' }
  }
  return { kind: 'latent' }
}

export function Dashboard() {
  const [beat, setBeat] = useState(0)
  const [started, setStarted] = useState(false)
  const [selectedId, setSelectedId] = useState<string>('g2')
  const reduce = useReducedMotion()
  const rootRef = useRef<HTMLDivElement>(null)
  const phase = CYCLE[reduce ? LAST_BEAT : beat].phase

  // Play once when scrolled into view.
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
  const trust = trustForPhase(phase)
  const proving = phase === 'proving_decoy' || phase === 'proving_root'
  const localized = isLocalized(phase)

  return (
    <div className="lshell" ref={rootRef}>
      <ReadoutBar
        runId={RUN_ID}
        task={RUN_TASK}
        verdict={verdict}
        meta={PHASE_STATUS[phase]}
        trust={trust}
        rate={proving ? 0 : phase === 'confirm' ? 1 : undefined}
        n={proving ? REPLAY_N : undefined}
        runtime={RUN_RUNTIME}
        monitorDecision={phase === 'confirm' ? 'auto_apply' : null}
      />

      <div className="lshell__cols">
        <Rail phase={phase} localized={localized} selectedId={selectedId} onSelect={setSelectedId} />
        <Center phase={phase} selectedId={selectedId} onSelect={setSelectedId} reduce={!!reduce} />
        <Inspector phase={phase} onReplay={replay} />
      </div>
    </div>
  )
}

// ============================ Left: monitor rail ============================
function Rail({ phase, localized, selectedId, onSelect }: {
  phase: Phase; localized: boolean; selectedId: string; onSelect: (id: string) => void
}) {
  return (
    <nav className="mrail lshell__rail" aria-label="Monitor rail">
      <div className="mrail__brand">
        <span className="mrail__mark" aria-hidden="true">
          <svg viewBox="0 0 16 16"><circle cx="8" cy="8" r="6.5" /><path d="M8 1.5 A6.5 6.5 0 0 1 8 14.5 Z" /></svg>
        </span>
        <span className="mrail__brandname">blackbox</span>
      </div>

      <section className="mrail__sec mrail__sec--id">
        <span className="mrail__idk">Trace</span>
        <span className="mrail__idv tnum" title={RUN_ID}>{RUN_ID}</span>
        <p className="mrail__task">{RUN_TASK}</p>
        <div className="mrail__idmeta">
          <Users size={13} strokeWidth={1.5} aria-hidden="true" />
          <span>{AGENTS.length} agents</span>
        </div>
      </section>

      <section className="mrail__sec">
        <h2 className="mrail__head">
          <Users className="mrail__headicon" size={16} strokeWidth={1.5} aria-hidden="true" />
          Agents
          <span className="mrail__count tnum">{AGENTS.length}</span>
        </h2>
        <ul className="roster">
          {AGENTS.map((a) => {
            const { state, tone } = agentGlyph(a, phase)
            const isRoot = localized && a.status === 'root'
            return (
              <li key={a.id}>
                <button type="button" className="roster__row" data-root={isRoot || undefined} disabled>
                  <Glyph state={state} tone={tone} />
                  <span className="roster__label">{a.label}</span>
                  {isRoot && <span className="roster__mark">root</span>}
                </button>
              </li>
            )
          })}
        </ul>
      </section>

      <section className="mrail__sec">
        <h2 className="mrail__head">
          <Workflow className="mrail__headicon" size={16} strokeWidth={1.5} aria-hidden="true" />
          Supervise
        </h2>
        <ol className="sup">
          {SUPERVISE.map((s, i) => {
            const st = stepperState(i, phase)
            const tone: GlyphTone = s.key === 'decide' && st === 'done' ? 'pass' : 'neutral'
            const Icon = s.key === 'localize' ? Crosshair : s.key === 'replay' ? GitFork : Gavel
            return (
              <li key={s.key} className="sup__step" data-state={st}>
                <Glyph state={st} tone={tone} />
                <Icon className="sup__icon" size={16} strokeWidth={1.5} aria-hidden="true" />
                <span className="sup__label">{s.label}</span>
                <span className="sup__note">{s.note}</span>
              </li>
            )
          })}
        </ol>
      </section>

      <section className="mrail__sec mrail__sec--grow">
        <h2 className="mrail__head">
          <Crosshair className="mrail__headicon" size={16} strokeWidth={1.5} aria-hidden="true" />
          Candidates
          <span className="mrail__count tnum">{CANDIDATES.length}</span>
        </h2>
        <ul className="cand">
          {CANDIDATES.map((c, i) => {
            const isLead = i === 0
            const tone: GlyphTone = isLead && localized ? 'root' : 'neutral'
            const glyph: GlyphState = isLead && localized ? 'done' : 'pending'
            const selected = selectedId === c.stepId
            return (
              <li key={c.stepId}>
                <button
                  type="button"
                  className="cand__row"
                  data-lead={isLead || undefined}
                  data-selected={selected || undefined}
                  onClick={() => onSelect(c.stepId)}
                >
                  <Glyph state={glyph} tone={tone} />
                  <span className="cand__id tnum">{c.stepId}</span>
                  <span className="cand__reason">{c.reason}</span>
                  <VerdictChip verdict={candidateVerdict(c, phase)} tone={tone} />
                  <span className="cand__meter" aria-hidden="true">
                    <span className="cand__fill" data-tone={tone} style={{ width: `${Math.round(c.suspicion * 100)}%` }} />
                  </span>
                  <span className="cand__score tnum" data-tone={tone}>{c.suspicion.toFixed(2)}</span>
                </button>
              </li>
            )
          })}
        </ul>
      </section>
    </nav>
  )
}

function VerdictChip({ verdict, tone }: { verdict: Verdict; tone: GlyphTone }) {
  if (verdict.kind === 'latent') return null
  if (verdict.kind === 'reject') {
    return <span className="cand__verdict" data-verdict="reject" title="replay did not flip">0/{REPLAY_N}</span>
  }
  const chipTone = verdict.confirmed ? 'pass' : tone === 'root' ? 'root' : 'neutral'
  return (
    <span
      className="cand__verdict"
      data-verdict={verdict.confirmed ? 'flip' : 'replaying'}
      data-tone={chipTone}
      title="replay flipped fail → pass"
    >
      {verdict.passed}/{REPLAY_N}
    </span>
  )
}

// ====================== Center: topology + provenance graph ======================
function Center({ phase, selectedId, onSelect, reduce }: {
  phase: Phase; selectedId: string; onSelect: (id: string) => void; reduce: boolean
}) {
  const analyzing = phase === 'analyze'
  const lit = phase !== 'idle'
  const healed = phase === 'confirm'
  const edgeStroke = healed ? 'var(--pass)' : 'var(--blast)'

  return (
    <section className="lshell__center">
      <div className="pane__head">
        <span className="eyebrow">Topology · agent wiring</span>
        <span className="pane__hint tnum">{TOPOLOGY.agents.length} agents · {TOPOLOGY.handoffs.length} handoffs</span>
      </div>
      <Topology topology={TOPOLOGY} phase={phase} />

      <div className="pane__head pane__head--spine">
        <span className="eyebrow">Provenance · trace</span>
        <span className="pane__hint tnum">{NODES.length} actions · {NODES.length} steps</span>
      </div>

      <div className="lshell__graph-scroll">
        <div className={`tg${analyzing ? ' tg--analyzing' : ''}`} style={{ width: GRAPH_W, height: GRAPH_H }}>
          <svg className="tg__edges" width={GRAPH_W} height={GRAPH_H} viewBox={`0 0 ${GRAPH_W} ${GRAPH_H}`}>
            {EDGES.map((e, i) => (
              <path
                key={`${e.from}-${e.to}`}
                d={e.d}
                fill="none"
                stroke={e.poison && lit ? edgeStroke : 'var(--edge)'}
                strokeWidth={e.poison && lit ? 1.6 : 1}
                opacity={e.poison && lit ? 0.85 : 0.5}
                style={{ transition: 'stroke var(--dur-base) var(--ease-out)', transitionDelay: lit && !healed ? `${i * STAGGER_MS}ms` : '0ms' }}
              />
            ))}
          </svg>

          {BAND_SEPS.map((y, i) => (
            <div key={`sep-${i}`} className="tg__band-sep" style={{ top: y, width: GRAPH_W }} />
          ))}
          {BANDS.map((b) => (
            <span key={b.label} className="tg__band-label" data-root={b.isRoot} style={{ top: b.y }}>
              {b.label}
            </span>
          ))}

          {NODES.map((n, i) => {
            const st = displayStatus(n.status, phase)
            const delay = (phase === 'blast' || phase === 'confirm') ? i * STAGGER_MS : 0
            return (
              <motion.div
                key={n.id}
                style={{ position: 'absolute', left: n.x, top: n.y, transitionDelay: `${delay}ms` }}
                initial={reduce ? false : { opacity: 0.6, scale: 0.98 }}
                animate={{ opacity: 1, scale: st === 'blast' ? [1, 1.06, 1] : 1 }}
                transition={reduce ? { duration: 0 } : { delay: i * 0.06, duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
              >
                <GraphNode
                  node={n}
                  status={st}
                  selected={selectedId === n.id}
                  onSelect={onSelect}
                  style={{ position: 'static', width: NODE_W, minHeight: NODE_H }}
                />
              </motion.div>
            )
          })}
        </div>
      </div>
    </section>
  )
}

// ============================ Right: inspector ============================
function Inspector({ phase, onReplay }: { phase: Phase; onReplay: () => void }) {
  const fields: Field[] = inspectorFields(phase)
  const pill = FOCAL_PILL[phase]
  const proving = phase === 'proving_decoy' || phase === 'proving_root'

  return (
    <aside className="lshell__inspect">
      <div className="pane__head lshell__inspect-head">
        <span className="eyebrow">Inspector</span>
        {pill && <span className="appshell__pill tnum">{pill}</span>}
      </div>

      <AnimatePresence mode="wait">
        <motion.div
          key={phase}
          className="lshell__inspect-body"
          initial={{ opacity: 0, x: 8 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -8 }}
          transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
        >
          {fields.map((f, idx) => (
            <motion.div
              key={f.label}
              className="field"
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.05 * idx, duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
            >
              <span className="field__label">{f.label}</span>
              <span className={`field__value tnum${f.tone ? ` field__value--${f.tone}` : ''}`}>{f.value}</span>
            </motion.div>
          ))}
        </motion.div>
      </AnimatePresence>

      <button
        type="button"
        className={`lshell__replay${phase === 'confirm' ? ' lshell__replay--done' : ''}`}
        onClick={onReplay}
        disabled={proving}
      >
        {phase === 'confirm' ? '✓ Fix confirmed'
          : proving ? 'Proving fix…'
          : 'Replay with fix'}
      </button>
    </aside>
  )
}
