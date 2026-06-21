import { motion, useReducedMotion, useScroll, useTransform, type Variants } from 'motion/react'
import { useRef } from 'react'
import { BrowserFrame } from './BrowserFrame'
import { Dashboard } from './Dashboard'

const reveal: Variants = {
  hidden: { opacity: 0, y: 16 },
  show: { opacity: 1, y: 0 },
}
const stagger: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.07, delayChildren: 0.04 } },
}

const LEGEND = [
  { tone: 'root', label: 'root cause' },
  { tone: 'blast', label: 'blast radius' },
  { tone: 'pass', label: 'confirmed fix' },
] as const

function fadeOut(
  progress: ReturnType<typeof useScroll>['scrollYProgress'],
  start: number,
  end: number,
) {
  return useTransform(progress, [start, end], [1, 0], { clamp: true })
}

export function HeroShowcase() {
  const stageRef = useRef<HTMLElement>(null)
  const reduce = useReducedMotion()

  const { scrollYProgress } = useScroll({
    target: stageRef,
    offset: ['start start', 'end end'],
  })

  /* Need tall scroll track so progress 0→1 while sticky pin holds the copy. */
  const headlineY = useTransform(scrollYProgress, [0, 0.55], [0, -32], { clamp: true })
  const restOpacity = fadeOut(scrollYProgress, 0.04, 0.32)
  const headlineOpacity = fadeOut(scrollYProgress, 0.18, 0.48)
  const hintOpacity = fadeOut(scrollYProgress, 0, 0.12)

  if (reduce) {
    return (
      <>
        <header className="hero">
          <motion.div className="hero__copy" initial="hidden" animate="show" variants={stagger}>
            <HeroCopy />
          </motion.div>
        </header>
        <ProductShowcase />
      </>
    )
  }

  return (
    <>
      <section ref={stageRef} className="hero-stage hero-stage--text" aria-label="Introduction">
        <div className="hero-stage__pin">
          <header className="hero hero--stage">
            <div className="hero__copy">
              <motion.div className="hero__headlines" style={{ y: headlineY, opacity: headlineOpacity }}>
                <p className="eyebrow">Causal supervisor · flight recorder for multi-agent systems</p>
                <h1 className="hero__title">
                  <span className="nowrap">The payment was wrong.</span>{' '}
                  <span className="nowrap">The mistake was three agents upstream.</span>
                </h1>
              </motion.div>

              <motion.div className="hero__rest" style={{ opacity: restOpacity }}>
                <HeroRest />
              </motion.div>
            </div>
          </header>

          <motion.div className="hero-stage__hint eyebrow" style={{ opacity: hintOpacity }} aria-hidden="true">
            <span>Scroll</span>
            <span className="hero-stage__chev" />
          </motion.div>
        </div>
      </section>

      <ProductShowcase />
    </>
  )
}

function HeroCopy() {
  return (
    <>
      <p className="eyebrow">Causal supervisor · flight recorder for multi-agent systems</p>
      <h1 className="hero__title">
        <span className="nowrap">The payment was wrong.</span>{' '}
        <span className="nowrap">The mistake was three agents upstream.</span>
      </h1>
      <HeroRest />
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
        <button className="btn btn--solid btn--lg" type="button">Start free</button>
        <a className="btn btn--ghost btn--lg" href="#docs">Read the docs</a>
      </div>
      <p className="hero__note">Open source · self-host in 5 minutes · no credit card</p>
    </>
  )
}

function ProductShowcase() {
  return (
    <section className="showcase showcase--persist" id="demo" aria-label="Product demo">
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
    </section>
  )
}
