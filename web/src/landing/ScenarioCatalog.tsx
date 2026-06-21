import { motion, useReducedMotion } from 'motion/react'
import { useState } from 'react'
import { SCENARIO_MANIFEST, type ScenarioManifest, type ScenarioTier } from '../scenarios/manifest'

const TIER_META: Record<ScenarioTier, { label: string; tone: string }> = {
  hero: { label: 'Hero', tone: 'hero' },
  research: { label: 'Research', tone: 'research' },
  sponsor: { label: 'Sponsor', tone: 'sponsor' },
  ops: { label: 'Ops', tone: 'ops' },
}

function spineLabel(scenario: ScenarioManifest): string {
  const emitted = new Set<string>()
  const segments: string[] = []
  for (const agent of scenario.agents) {
    if (emitted.has(agent.id)) continue
    const group = scenario.parallel.find((g) => g.includes(agent.id))
    if (group) {
      segments.push(
        group
          .map((id) => scenario.agents.find((a) => a.id === id)?.label ?? id)
          .join(' ∥ '),
      )
      group.forEach((id) => emitted.add(id))
    } else {
      segments.push(agent.label)
      emitted.add(agent.id)
    }
  }
  return segments.join(' → ')
}

function AgentSpine({ scenario }: { scenario: ScenarioManifest }) {
  return (
    <p className="scenario-spine tnum" aria-hidden="true">
      {spineLabel(scenario)}
    </p>
  )
}

function ScenarioCard({
  scenario,
  active,
  onSelect,
}: {
  scenario: ScenarioManifest
  active: boolean
  onSelect: () => void
}) {
  const tier = TIER_META[scenario.tier]
  const forkAgent = scenario.agents.find((a) => a.id === scenario.fault.agent)

  return (
    <motion.article
      className={`scenario-card scenario-card--${tier.tone}${active ? ' scenario-card--active' : ''}`}
      layout
      onClick={onSelect}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          onSelect()
        }
      }}
      role="button"
      tabIndex={0}
      aria-pressed={active}
    >
      <header className="scenario-card__head">
        <span className={`scenario-card__tier scenario-card__tier--${tier.tone}`}>{tier.label}</span>
        <h3 className="scenario-card__title">{scenario.label}</h3>
        <p className="scenario-card__tagline">{scenario.tagline}</p>
      </header>

      <AgentSpine scenario={scenario} />

      <dl className="scenario-card__facts">
        <div className="scenario-card__fact">
          <dt>LangGraph fork</dt>
          <dd>
            <code className="tnum">update_state(as_node=&quot;{forkAgent?.langgraphNode ?? scenario.fault.agent}&quot;)</code>
          </dd>
        </div>
        <div className="scenario-card__fact">
          <dt>Root fault</dt>
          <dd>
            <span className="scenario-card__agent">{forkAgent?.label ?? scenario.fault.agent}</span>
            · {scenario.fault.field} — {scenario.fault.symptom}
          </dd>
        </div>
        <div className="scenario-card__fact">
          <dt>Decoy</dt>
          <dd>
            {scenario.decoy.agent} / {scenario.decoy.field} — replay does not flip
          </dd>
        </div>
      </dl>

      {active && (
        <motion.div
          className="scenario-card__detail"
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          exit={{ opacity: 0, height: 0 }}
        >
          <p className="scenario-card__task eyebrow">{scenario.task}</p>
          <ul className="scenario-card__agents">
            {scenario.agents.map((a) => (
              <li key={a.id}>
                <span className="scenario-card__agent-name">{a.label}</span>
                <span className="scenario-card__agent-role">{a.role}</span>
              </li>
            ))}
          </ul>
          <div className="scenario-card__evals">
            <span className="eyebrow">Arize evaluators</span>
            <div className="scenario-card__chips">
              {scenario.arize.evaluators.map((ev) => (
                <span key={ev} className="chip chip--mono">{ev}</span>
              ))}
            </div>
            <span className="scenario-card__traces tnum">
              traces: {scenario.arize.fail} → {scenario.arize.healed}
            </span>
          </div>
        </motion.div>
      )}
    </motion.article>
  )
}

/** Four demo domains — hero insurance + research clinical + sponsor procurement + ops SOC. */
export function ScenarioCatalog() {
  const [activeId, setActiveId] = useState<string>(SCENARIO_MANIFEST[0].id)
  const reduce = useReducedMotion()

  return (
    <section className="scenarios" id="scenarios" aria-label="Demo scenarios">
      <p className="eyebrow sect__eyebrow">Demo domains</p>
      <h2 className="sect__title">Four pipelines. One attribution method.</h2>
      <p className="sect__lead scenarios__lead">
        Each domain is a LangGraph multi-agent graph with structured hand-offs, an injected root fault,
        a decoy that replay rejects, and Arize evaluators for the improvement loop. Clinical prior auth
        is the research-heavy suite — batch fault variants and LLM-as-judge grounding evals.
      </p>

      <div className="scenarios__grid">
        {SCENARIO_MANIFEST.map((s, i) => (
          <motion.div
            key={s.id}
            initial={reduce ? false : { opacity: 0, y: 12 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.2 }}
            transition={{ delay: i * 0.06, duration: 0.35 }}
          >
            <ScenarioCard
              scenario={s}
              active={activeId === s.id}
              onSelect={() => setActiveId((prev) => (prev === s.id ? prev : s.id))}
            />
          </motion.div>
        ))}
      </div>
    </section>
  )
}
