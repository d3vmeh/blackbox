// web/src/dashboard/MonitorRail.tsx
// Left rail = the live MONITOR rail (Linear's nav, reframed as a forensic case file).
// Every row is live. Four blocks, generous breathing room between them:
//   1. RUN IDENTITY  — agent/model/trace id, quiet
//   2. AGENTS roster — one status-ring Glyph per agent; the failed (root) agent's
//      glyph is the lone non-neutral mark; clicking an agent dims the others.
//   3. SUPERVISE     — localize → replay → decide stepper with advancing glyphs.
//   4. CANDIDATES    — ranked suspects with an inline replay verdict; the decoy
//      shows a neutral-rejected 0/n chip (NEVER a signal hue); the root shows the
//      flip. The leading suspect carries --root once localized.
//
// Lucide icons are NEUTRAL affordance only (--text-dim default). State is carried
// by the Glyph (shape + fill) and the closed 3-signal set — never by icon color.
import { Crosshair, GitFork, Gavel, Users, Workflow } from 'lucide-react'
import type { AgentId, Attribution, MonitorDecision, Trace } from '../types'
import type { ActionGraph, AgentTopology, NodeStatus } from './types'
import { Glyph, type GlyphState, type GlyphTone } from './Glyph'
import { deriveTopology } from './deriveTopology'
import type { Phase } from './phase'
import './MonitorRail.css'

// ---- SUPERVISE stepper: the monitor's job, three beats ----
const SUPERVISE: { key: string; label: string; note: string }[] = [
  { key: 'localize', label: 'Localize', note: 'rank suspects' },
  { key: 'replay', label: 'Replay', note: 'fork · inject' },
  { key: 'decide', label: 'Decide', note: 'trust · apply' },
]

// How far the monitor has advanced for a given phase (index into SUPERVISE that is "active").
const PHASE_REACH: Record<Phase, number> = {
  idle: -1, blast: 0, analyze: 0, proving_decoy: 1, proving_root: 1, rejected: 1, confirm: 2,
}

function stepperState(idx: number, phase: Phase): GlyphState {
  const reach = PHASE_REACH[phase]
  if (phase === 'confirm') return 'done'
  if (idx < reach) return 'done'
  if (idx === reach) return 'active'
  return 'pending'
}

// Localization has produced a verdict once analyze (or later) has run.
function isLocalized(phase: Phase): boolean {
  return phase === 'analyze' || phase === 'proving_decoy' || phase === 'proving_root'
    || phase === 'rejected' || phase === 'confirm'
}

// ---- AGENTS roster glyph: neutral by default; the root agent is the lone signal ----
function agentGlyph(status: NodeStatus, phase: Phase): { state: GlyphState; tone: GlyphTone } {
  // Before localization the roster is latent (all pending, neutral).
  if (!isLocalized(phase)) return { state: 'pending', tone: 'neutral' }
  if (status === 'root') return { state: 'done', tone: 'root' }
  return { state: 'done', tone: 'neutral' }
}

// ---- CANDIDATES inline replay verdict ----
// Each candidate gets a small verdict chip once the monitor has replayed it:
//   · root   → flips (k/n; --pass only on the confirmed flip)
//   · decoy  → does NOT flip → neutral-rejected 0/n chip (NEVER a signal hue)
//   · latent → no replay yet
type Verdict =
  | { kind: 'latent' }
  | { kind: 'flip'; passed: number; total: number; confirmed: boolean }
  | { kind: 'reject'; total: number }

function candidateVerdict(
  isRoot: boolean,
  phase: Phase,
  monitor: MonitorDecision | undefined,
): Verdict {
  const total = monitor?.replay.n ?? 0
  if (isRoot) {
    // The root replay runs during proving_root and lands on confirm.
    if (phase === 'confirm') {
      const passed = total > 0 ? Math.round((monitor?.replay.confirmation_rate ?? 0) * total) : 0
      return { kind: 'flip', passed, total, confirmed: true }
    }
    if (phase === 'proving_root') return { kind: 'flip', passed: 0, total, confirmed: false }
    return { kind: 'latent' }
  }
  // Decoy candidates: the monitor replays the leading decoy first and it never flips.
  if (phase === 'proving_decoy' || phase === 'proving_root' || phase === 'confirm' || phase === 'rejected') {
    return { kind: 'reject', total }
  }
  return { kind: 'latent' }
}

export interface MonitorRailProps {
  trace: Trace
  attribution: Attribution
  graph: ActionGraph
  phase: Phase
  selectedId: string | null
  onSelect: (nodeId: string) => void
  /** topology override; falls back to deriveTopology(graph, attribution) */
  topology?: AgentTopology
  /** selected agent (dims the other bands in the spine); null = all live */
  selectedAgentId?: AgentId | null
  /** clicking an agent row in the roster */
  onSelectAgent?: (agentId: AgentId) => void
  /** the monitor's replay decision, drives the inline candidate verdicts */
  monitor?: MonitorDecision
}

export function MonitorRail({
  trace,
  attribution,
  graph,
  phase,
  selectedId,
  onSelect,
  topology,
  selectedAgentId = null,
  onSelectAgent,
  monitor,
}: MonitorRailProps) {
  const nodeForStep = (stepId: string) =>
    graph.nodes.find((n) => n.stepIds.includes(stepId))?.id ?? null
  const top = topology ?? deriveTopology(graph, attribution)
  const localized = isLocalized(phase)

  // Run identity readout: a quiet agent-count tag (single-agent traces read "single agent").
  const agentLabel = top.agents.length > 1 ? `${top.agents.length} agents` : 'single agent'

  return (
    <nav className="mrail" aria-label="Monitor rail">
      {/* 0 — BRAND (Linear puts the logo at the top of the nav) */}
      <div className="mrail__brand">
        <span className="mrail__mark" aria-hidden="true">
          <svg viewBox="0 0 16 16"><circle cx="8" cy="8" r="6.5" /><path d="M8 1.5 A6.5 6.5 0 0 1 8 14.5 Z" /></svg>
        </span>
        <span className="mrail__brandname">blackbox</span>
      </div>

      {/* 1 — RUN IDENTITY */}
      <section className="mrail__sec mrail__sec--id">
        <div className="mrail__id">
          <span className="mrail__idk">trace</span>
          <span className="mrail__idv tnum">{trace.id}</span>
        </div>
        <p className="mrail__task">{trace.task}</p>
        <div className="mrail__idmeta">
          <span className="mrail__idtag">{agentLabel}</span>
        </div>
      </section>

      {/* 2 — AGENTS roster */}
      <section className="mrail__sec">
        <h2 className="mrail__head">
          <Users className="mrail__headicon" size={16} strokeWidth={1.5} aria-hidden="true" />
          Agents
          <span className="mrail__count tnum">{top.agents.length}</span>
        </h2>
        <ul className="roster">
          {top.agents.map((a) => {
            const { state, tone } = agentGlyph(a.status, phase)
            const selected = selectedAgentId === a.id
            const dimmed = selectedAgentId != null && !selected
            const isRootAgent = localized && a.status === 'root'
            return (
              <li key={a.id}>
                <button
                  type="button"
                  className="roster__row"
                  data-selected={selected || undefined}
                  data-dimmed={dimmed || undefined}
                  data-root={isRootAgent || undefined}
                  aria-pressed={selected}
                  disabled={!onSelectAgent}
                  onClick={() => onSelectAgent?.(a.id)}
                >
                  <Glyph state={state} tone={tone} />
                  <span className="roster__label">{a.label}</span>
                  {isRootAgent && <span className="roster__mark">root</span>}
                </button>
              </li>
            )
          })}
        </ul>
      </section>

      {/* 3 — SUPERVISE stepper */}
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

      {/* 4 — CANDIDATES */}
      <section className="mrail__sec mrail__sec--grow">
        <h2 className="mrail__head">
          <Crosshair className="mrail__headicon" size={16} strokeWidth={1.5} aria-hidden="true" />
          Candidates
          <span className="mrail__count tnum">{attribution.candidates.length}</span>
        </h2>
        <ul className="cand">
          {attribution.candidates.map((c, i) => {
            const nodeId = nodeForStep(c.step_id)
            const isLead = i === 0
            const selected = nodeId != null && nodeId === selectedId
            // The leading suspect IS the localized root → it earns --root once localized.
            const tone: GlyphTone = isLead && localized ? 'root' : 'neutral'
            const glyph: GlyphState = isLead && localized ? 'done' : 'pending'
            const verdict = candidateVerdict(isLead, phase, monitor)
            return (
              <li key={c.step_id}>
                <button
                  type="button"
                  className="cand__row"
                  data-lead={isLead || undefined}
                  data-selected={selected || undefined}
                  disabled={nodeId == null}
                  onClick={() => nodeId && onSelect(nodeId)}
                >
                  <Glyph state={glyph} tone={tone} />
                  <span className="cand__id tnum">{c.step_id}</span>
                  <span className="cand__reason">{c.reason}</span>
                  <VerdictChip verdict={verdict} tone={tone} />
                  <span className="cand__meter" aria-hidden="true">
                    <span
                      className="cand__fill"
                      data-tone={tone}
                      style={{ width: `${Math.round(c.suspicion * 100)}%` }}
                    />
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

/**
 * The inline per-candidate replay verdict chip. A flip shows k/n (and earns
 * --pass only once confirmed). A reject shows a neutral 0/n in a dashed --line
 * pill — NEVER a signal hue, that's the whole point of disproving a decoy.
 */
function VerdictChip({ verdict, tone }: { verdict: Verdict; tone: GlyphTone }) {
  if (verdict.kind === 'latent') return null
  if (verdict.kind === 'reject') {
    return (
      <span className="cand__verdict" data-verdict="reject" title="replay did not flip">
        0/{verdict.total}
      </span>
    )
  }
  // flip — while replaying the root the chip stays neutral/--root; only the
  // confirmed flip is allowed to read --pass (the lone signal use here).
  const chipTone = verdict.confirmed ? 'pass' : tone === 'root' ? 'root' : 'neutral'
  return (
    <span
      className="cand__verdict"
      data-verdict={verdict.confirmed ? 'flip' : 'replaying'}
      data-tone={chipTone}
      title="replay flipped fail → pass"
    >
      {verdict.passed}/{verdict.total}
    </span>
  )
}

// Backwards-compatible alias for a smooth swap while integration rewires imports.
export const CaseNav = MonitorRail
