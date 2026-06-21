import { motion, useReducedMotion, useScroll, useTransform, type Variants } from 'motion/react'
import { useRef } from 'react'
import { BrowserFrame } from './BrowserFrame'
import { Dashboard } from './Dashboard'

const stagger: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.07, delayChildren: 0.04 } },
}

const LEGEND = [
  { tone: 'root', label: 'root cause' },
  { tone: 'blast', label: 'blast radius' },
  { tone: 'pass', label: 'confirmed fix' },
] as const

/** Hold full opacity at scroll 0, fade out, then stay at 0 — reverses cleanly on scroll up. */
function scrollFade(
  progress: ReturnType<typeof useScroll>['scrollYProgress'],
  fadeStart: number,
  fadeEnd: number,
) {
  return useTransform(progress, [0, fadeStart, fadeEnd, 1], [1, 1, 0, 0], { clamp: true })
}

export function HeroShowcase() {
  const stageRef = useRef<HTMLElement>(null)
  const reduce = useReducedMotion()

  const { scrollYProgress } = useScroll({
    target: stageRef,
    offset: ['start start', 'end end'],
  })

  /* Tall scroll track while sticky pin holds copy; opacity only (no Y shift — avoids pop on scroll up). */
  const hintOpacity = scrollFade(scrollYProgress, 0.02, 0.12)
  const copyOpacity = scrollFade(scrollYProgress, 0.08, 0.48)

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
            <motion.div className="hero__copy" style={{ opacity: copyOpacity }}>
              <div className="hero__headlines">
                <p className="eyebrow">Causal supervisor · flight recorder for multi-agent systems</p>
                <h1 className="hero__title">
                  <span className="hero__title-line">The payout was wrong.</span>
                  <span className="hero__title-line">The mistake was at INTAKE —</span>
                  <span className="hero__title-line">three agents upstream of the symptom.</span>
                </h1>
              </div>
              <div className="hero__rest">
                <HeroRest />
              </div>
            </motion.div>
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
        <span className="hero__title-line">The payout was wrong.</span>
        <span className="hero__title-line">The mistake was at INTAKE —</span>
        <span className="hero__title-line">three agents upstream of the symptom.</span>
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
        <a className="btn btn--solid btn--lg" href="#dashboard">Open dashboard</a>
        <a className="btn btn--ghost btn--lg" href="#how">How it works</a>
      </div>
      <p className="hero__note">Open source · self-host in 5 minutes · no credit card</p>
    </>
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
