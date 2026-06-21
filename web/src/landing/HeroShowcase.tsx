import { motion, useReducedMotion, useScroll, useTransform } from 'motion/react'
import { useRef } from 'react'
import { BrowserFrame } from './BrowserFrame'
import { Dashboard } from './Dashboard'

const LEGEND = [
  { tone: 'root', label: 'root cause' },
  { tone: 'blast', label: 'blast radius' },
  { tone: 'pass', label: 'confirmed fix' },
] as const

const STATS = [
  { value: '~14%', label: 'SOTA step-attribution we beat by proof' },
  { value: 'fail→pass', label: 'every fix confirmed by replay' },
  { value: '0', label: 'fixes trusted before replay proves them' },
] as const

export function HeroShowcase() {
  const stageRef = useRef<HTMLElement>(null)
  const reduce = useReducedMotion()

  const { scrollYProgress } = useScroll({
    target: stageRef,
    offset: ['start start', 'end end'],
  })

  /* Title stays pinned at top, then fades as you scroll into the body. */
  const titleOpacity = useTransform(scrollYProgress, [0, 0.4, 0.72], [1, 1, 0], { clamp: true })

  return (
    <>
      <section ref={stageRef} className="hero-stage" aria-hidden={false}>
        <div className="hero-stage__pin">
          <motion.header
            className="hero hero--title"
            aria-label="Introduction"
            style={reduce ? undefined : { opacity: titleOpacity }}
          >
            <p className="eyebrow">Causal supervisor · flight recorder for multi-agent systems</p>
            <h1 className="hero__title">
              <span className="hero__title-line">The payment was wrong.</span>
              <span className="hero__title-line">The mistake was three agents upstream.</span>
            </h1>
          </motion.header>
        </div>
      </section>

      <div className="hero__body">
        <HeroRest />
      </div>

      <StatsBand />
      <ProductShowcase />
    </>
  )
}

function HeroRest() {
  return (
    <>
      <p className="hero__sub">
        When agents collaborate, one early mistake corrupts a hand-off and every
        downstream agent trusts it. blackbox localizes the agent at fault on the
        hand-off graph, traces the blast radius across agents, and proves the fix
        by replay — before it heals the run or escalates to a human. Confirmed by
        intervention, not by asking an LLM who’s to blame.
      </p>
      <div className="hero__actions">
        <button
          className="btn btn--solid btn--lg"
          type="button"
          onClick={() => { window.location.hash = 'dashboard' }}
        >
          Start free
        </button>
        <a className="btn btn--ghost btn--lg" href="#docs">Read the docs</a>
      </div>
      <p className="hero__note">Open source · self-host in 5 minutes · no credit card</p>
    </>
  )
}

function StatsBand() {
  return (
    <section className="landing-stats" aria-label="Key metrics">
      {STATS.map((s) => (
        <div key={s.label} className="landing-stat">
          <span className="landing-stat__value tnum">{s.value}</span>
          <span className="landing-stat__label">{s.label}</span>
        </div>
      ))}
    </section>
  )
}

function ProductShowcase() {
  return (
    <section className="showcase showcase--persist" id="demo" aria-label="Product demo">
      <div className="showcase__glow" aria-hidden="true" />
      <BrowserFrame url="app.blackbox.dev/runs/claim_run">
        <Dashboard />
      </BrowserFrame>
      <div className="legend">
        {LEGEND.map((l) => (
          <span key={l.tone} className="legend__item">
            <span className={`legend__dot dot--${l.tone}`} aria-hidden="true" />
            {l.label}
          </span>
        ))}
      </div>
    </section>
  )
}
