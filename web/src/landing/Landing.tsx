import { motion, type Variants } from 'motion/react'
import { BrowserFrame } from './BrowserFrame'
import { Dashboard } from './Dashboard'
import './landing.css'

const reveal: Variants = {
  hidden: { opacity: 0, y: 16 },
  show: { opacity: 1, y: 0 },
}
const stagger: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.07, delayChildren: 0.04 } },
}
const VIEWPORT = { once: true, amount: 0.3 } as const

const LEGEND = [
  { tone: 'root', label: 'root cause' },
  { tone: 'blast', label: 'blast radius' },
  { tone: 'pass', label: 'confirmed fix' },
] as const

const INTEGRATIONS = ['LangGraph', 'OpenTelemetry', 'Arize Phoenix', 'Redis', 'Sentry', 'Browserbase']

const STEPS = [
  { no: '01', tone: '', title: 'Record', body: 'Capture the multi-agent run as one causal graph — every reasoning step, tool call, and hand-off payload passed between agents.' },
  { no: '02', tone: 'root', title: 'Localize', body: 'Find the earliest agent whose output is wrong given its own inputs — and the corrupted hand-off it propagated. Not where the run finally crashed.' },
  { no: '03', tone: 'blast', title: 'Blast radius', body: 'Slice the graph forward across agent boundaries — every later step, in any agent, that trusted the corrupted value.' },
  { no: '04', tone: 'pass', title: 'Confirm', body: 'Fork at the root, inject the corrected value, and re-run. Fail → pass confirms it; a decoy that doesn’t flip is rejected.' },
  { no: '05', tone: 'pass', title: 'Supervise', body: 'Only a replay-proven fix is trusted. The monitor auto-heals the run, or escalates to a human with a structured correction.' },
] as const

const FEATURES = [
  { tone: '', title: 'Causal, not chronological', body: 'Edges are true data-flow dependencies — which hand-off fed which agent — not “the previous step”.' },
  { tone: 'root', title: 'The agent at fault, not the last to crash', body: 'Localize the earliest agent whose output doesn’t follow from its inputs, far from where the symptom surfaced.' },
  { tone: 'blast', title: 'Blast radius across agents', body: 'See every downstream agent that inherited a corrupted hand-off, so you know the true scope.' },
  { tone: 'pass', title: 'Replay-confirmed, never guessed', body: 'Proof by re-run. No fix is trusted until replay flips fail → pass; a non-flip disproves the candidate.' },
  { tone: '', title: 'Trust gate before any action', body: 'A proposed fix stays untrusted until replay proves it — then the monitor auto-heals or escalates to a human.' },
  { tone: '', title: 'Mechanical, not an LLM guessing', body: 'Localize → replay → decide is plain code. The only model in the loop judges one step in isolation.' },
] as const

const STATS = [
  { value: '~14%', label: 'SOTA step-attribution we beat by proof' },
  { value: 'fail→pass', label: 'every fix confirmed by replay' },
  { value: '0', label: 'fixes trusted before replay proves them' },
] as const

export function Landing() {
  return (
    <div className="page">
      <nav className="nav">
        <a className="brand" href="/">
          <span className="brand__mark" aria-hidden="true" />
          blackbox
        </a>
        <div className="nav__links">
          <a href="#how">How it works</a>
          <a href="#features">Features</a>
          <a href="#docs">Docs</a>
          <a href="#github">GitHub</a>
        </div>
        <div className="nav__cta">
          <a className="nav__signin" href="#login">Sign in</a>
          <button className="btn btn--solid" type="button">Start free</button>
        </div>
      </nav>

      <header className="hero">
        <motion.div className="hero__copy" initial="hidden" animate="show" variants={stagger}>
          <motion.p className="eyebrow" variants={reveal}>
            Causal supervisor · flight recorder for multi-agent systems
          </motion.p>
          <motion.h1 className="hero__title" variants={reveal}>
            <span className="nowrap">The payment was wrong.</span>{' '}
            <span className="nowrap">The mistake was three agents upstream.</span>
          </motion.h1>
          <motion.p className="hero__sub" variants={reveal}>
            When agents collaborate, one early mistake corrupts a hand-off and every
            downstream agent trusts it. blackbox localizes the agent at fault on the
            hand-off graph, traces the blast radius across agents, and proves the fix
            by replay — before it heals the run or escalates to a human. Confirmed by
            intervention, not by asking an LLM who’s to blame.
          </motion.p>
          <motion.div className="hero__actions" variants={reveal}>
            <button className="btn btn--solid btn--lg" type="button">Start free</button>
            <a className="btn btn--ghost btn--lg" href="#docs">Read the docs</a>
          </motion.div>
          <motion.p className="hero__note" variants={reveal}>
            Open source · self-host in 5 minutes · no credit card
          </motion.p>
        </motion.div>
      </header>

      <motion.section
        className="showcase"
        initial={{ y: 28, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1], delay: 0.2 }}
      >
        <div className="showcase__glow" aria-hidden="true" />
        <BrowserFrame url="app.blackbox.dev/runs/ap_7c2">
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
      </motion.section>

      {/* ---- Install + integrations ---- */}
      <motion.section className="install" variants={stagger} initial="hidden" whileInView="show" viewport={VIEWPORT}>
        <motion.div className="install__copy" variants={reveal}>
          <p className="eyebrow">Wire it in</p>
          <h2 className="sect__title">Standards in. No agent rewrite.</h2>
          <p className="sect__lead">
            blackbox ingests OpenTelemetry agent spans and LangGraph checkpoints —
            every step, tool call, and hand-off between your agents — and runs the
            attribution when the run fails.
          </p>
          <div className="install__chips">
            {INTEGRATIONS.map((i) => (
              <span key={i} className="chip">{i}</span>
            ))}
          </div>
        </motion.div>
        <motion.div className="code" variants={reveal} aria-hidden="true">
          <div className="code__bar"><span className="code__file tnum">quickstart.py</span></div>
          <pre className="code__body">
<span className="c-dim">$ pip install blackbox</span>{'\n\n'}
<span className="c-key">from</span> blackbox <span className="c-key">import</span> supervise{'\n\n'}
<span className="c-key">with</span> supervise(team):       <span className="c-dim"># records every hand-off</span>{'\n'}
{'    '}team.run(invoice)       <span className="c-dim"># your agents, unchanged</span>{'\n\n'}
<span className="c-dim"># a run failed? localize the agent + prove the fix:</span>{'\n'}
<span className="c-dim">$ blackbox replay ap_7c2 --confirm</span>
          </pre>
        </motion.div>
      </motion.section>

      {/* ---- How it works (timeline) ---- */}
      <motion.section className="how" id="how" variants={stagger} initial="hidden" whileInView="show" viewport={VIEWPORT}>
        <motion.p className="eyebrow sect__eyebrow" variants={reveal}>How it works</motion.p>
        <motion.h2 className="sect__title" variants={reveal}>From failed run to confirmed fix.</motion.h2>
        <div className="timeline">
          <div className="timeline__rule" aria-hidden="true" />
          {STEPS.map((s) => (
            <motion.article key={s.no} className="tl" variants={reveal}>
              <span className={`tl__no tnum${s.tone ? ` tone--${s.tone}` : ''}`}>{s.no}</span>
              <h3 className="tl__title">{s.title}</h3>
              <p className="tl__body">{s.body}</p>
            </motion.article>
          ))}
        </div>
      </motion.section>

      {/* ---- Stats band ---- */}
      <section className="stats">
        {STATS.map((s) => (
          <div key={s.label} className="stat">
            <span className="stat__value tnum">{s.value}</span>
            <span className="stat__label">{s.label}</span>
          </div>
        ))}
      </section>

      {/* ---- Features ---- */}
      <motion.section className="features" id="features" variants={stagger} initial="hidden" whileInView="show" viewport={VIEWPORT}>
        <motion.p className="eyebrow sect__eyebrow" variants={reveal}>Why blackbox</motion.p>
        <motion.h2 className="sect__title" variants={reveal}>Logs tell you the team failed.<br />blackbox tells you which agent — and proves it.</motion.h2>
        <div className="features__grid">
          {FEATURES.map((f) => (
            <motion.article key={f.title} className={`feature${f.tone ? ` feature--${f.tone}` : ''}`} variants={reveal}>
              <h3 className="feature__title">{f.title}</h3>
              <p className="feature__body">{f.body}</p>
            </motion.article>
          ))}
        </div>
      </motion.section>

      {/* ---- CTA ---- */}
      <motion.section className="cta" variants={stagger} initial="hidden" whileInView="show" viewport={VIEWPORT}>
        <div className="cta__glow" aria-hidden="true" />
        <motion.h2 className="cta__title" variants={reveal}>
          Stop guessing which agent failed.<br />Start proving it.
        </motion.h2>
        <motion.div className="hero__actions" variants={reveal}>
          <button className="btn btn--solid btn--lg" type="button">Start free</button>
          <a className="btn btn--ghost btn--lg" href="#docs">Read the docs</a>
        </motion.div>
        <motion.p className="hero__note" variants={reveal}>
          Open source · self-host in 5 minutes
        </motion.p>
      </motion.section>

      <footer className="foot">
        <div className="foot__brand">
          <span className="brand">
            <span className="brand__mark" aria-hidden="true" />
            blackbox
          </span>
          <span className="foot__meta eyebrow">forensic supervisor for multi-agent systems</span>
        </div>
        <div className="foot__cols">
          <FootCol title="Product" links={['Runs', 'Traces', 'Evals', 'Replays']} />
          <FootCol title="Resources" links={['Docs', 'Changelog', 'GitHub']} />
          <FootCol title="Company" links={['About', 'Careers', 'Contact']} />
        </div>
      </footer>
    </div>
  )
}

function FootCol({ title, links }: { title: string; links: string[] }) {
  return (
    <div className="foot__col">
      <span className="eyebrow">{title}</span>
      {links.map((l) => (
        <a key={l} href="#" className="foot__link">{l}</a>
      ))}
    </div>
  )
}
