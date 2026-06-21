import { useEffect } from 'react'
import { motion, type Variants } from 'motion/react'
import { HeroShowcase } from './HeroShowcase'
import { HowItWorksDeck } from './HowItWorksDeck'
import { SystemMap } from './SystemMap'
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

const INTEGRATIONS = ['LangGraph', 'OpenTelemetry', 'Arize Phoenix', 'Redis', 'Sentry', 'Browserbase']

const FEATURES = [
  { tone: 'record', title: 'Causal, not chronological', body: 'Edges are true data-flow dependencies — which hand-off fed which agent — not “the previous step”.' },
  { tone: 'root', title: 'The agent at fault, not the last to crash', body: 'Localize the earliest agent whose output doesn’t follow from its inputs, far from where the symptom surfaced.' },
  { tone: 'blast', title: 'Blast radius across agents', body: 'See every downstream agent that inherited a corrupted hand-off, so you know the true scope.' },
  { tone: 'pass', title: 'Replay-confirmed, never guessed', body: 'Proof by re-run. No fix is trusted until replay flips fail → pass; a non-flip disproves the candidate.' },
  { tone: 'trust', title: 'Trust gate before any action', body: 'A proposed fix stays untrusted until replay proves it — then the monitor auto-heals or escalates to a human.' },
  { tone: 'mechanical', title: 'Mechanical, not an LLM guessing', body: 'Localize → replay → decide is plain code. The only model in the loop judges one step in isolation.' },
] as const

export function Landing() {
  useEffect(() => { window.scrollTo(0, 0) }, [])

  return (
    <div className="page">
      <nav className="nav">
        <a className="brand" href="/" onClick={() => { window.location.hash = '' }}>
          <span className="brand__mark" aria-hidden="true" />
          blackbox
        </a>
        <div className="nav__links">
          <a href="#how">How it works</a>
          <a href="#features">Features</a>
          <a href="#system-map">System map</a>
          <a href="#docs">Docs</a>
          <a href="#github">GitHub</a>
        </div>
        <div className="nav__cta">
          <a className="nav__signin" href="#login">Sign in</a>
          <button className="btn btn--solid" type="button" onClick={() => { window.location.hash = 'dashboard' }}>Start free</button>
        </div>
      </nav>

      <HeroShowcase />

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
<span className="c-dim">$ pip install blackbox langgraph</span>{'\n\n'}
<span className="c-key">from</span> agent.ap.export_run <span className="c-key">import</span> build_artifacts{'\n\n'}
build_artifacts()  <span className="c-dim"># INTAKE → COVERAGE ∥ FRAUD → PAYOUT</span>{'\n'}
<span className="c-dim"># on FAIL: localize root + replay-confirm before trust gate:</span>{'\n'}
<span className="c-dim">$ python -m agent.ap.export_run && open /#dashboard</span>
          </pre>
        </motion.div>
      </motion.section>

      <HowItWorksDeck />

      {/* ---- Features ---- */}
      <motion.section className="features" id="features" variants={stagger} initial="hidden" whileInView="show" viewport={VIEWPORT}>
        <motion.p className="eyebrow sect__eyebrow" variants={reveal}>Why blackbox</motion.p>
        <motion.h2 className="sect__title" variants={reveal}>Logs tell you the team failed.<br />blackbox tells you which agent — and proves it.</motion.h2>
        <div className="features__grid">
          {FEATURES.map((f) => (
            <motion.article key={f.title} className={`feature feature--${f.tone}`} variants={reveal}>
              <h3 className="feature__title">{f.title}</h3>
              <p className="feature__body">{f.body}</p>
            </motion.article>
          ))}
        </div>
      </motion.section>

      <SystemMap />

      {/* ---- CTA ---- */}
      <motion.section className="cta" variants={stagger} initial="hidden" whileInView="show" viewport={VIEWPORT}>
        <div className="cta__glow" aria-hidden="true" />
        <motion.h2 className="cta__title" variants={reveal}>
          Stop guessing which agent failed.<br />Start proving it.
        </motion.h2>
        <motion.div className="hero__actions" variants={reveal}>
          <button className="btn btn--solid btn--lg" type="button" onClick={() => { window.location.hash = 'dashboard' }}>Start free</button>
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
