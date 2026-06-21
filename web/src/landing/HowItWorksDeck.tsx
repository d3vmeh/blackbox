import {
  motion,
  useMotionValueEvent,
  useReducedMotion,
  useScroll,
  type MotionValue,
} from 'motion/react'
import { useCallback, useRef, useState } from 'react'
import { HOW_STEPS, type HowStep } from './howSteps'

/** Vertical scroll budget per card while pinned — higher = slower deck rotation. */
const SCROLL_VH_PER_CARD = 105

/** Map scroll progress to a card index — equal segments, last card included at progress 1. */
function indexFromScrollProgress(v: number, count: number): number {
  if (v <= 0) return 0
  if (v >= 1) return count - 1
  return Math.min(Math.floor(v * count), count - 1)
}

export function HowItWorksDeck() {
  const stageRef = useRef<HTMLElement>(null)
  const reduce = useReducedMotion()
  const [active, setActive] = useState(0)
  const activeRef = useRef(0)
  const pointerStart = useRef<number | null>(null)
  const userNavUntil = useRef(0)

  const { scrollYProgress } = useScroll({
    target: stageRef,
    offset: ['start start', 'end end'],
  })

  const goTo = useCallback((index: number) => {
    const next = Math.min(Math.max(index, 0), HOW_STEPS.length - 1)
    userNavUntil.current = performance.now() + 1800
    activeRef.current = next
    setActive(next)
  }, [])

  useMotionValueEvent(scrollYProgress, 'change', (v) => {
    if (performance.now() < userNavUntil.current) return
    const idx = indexFromScrollProgress(v, HOW_STEPS.length)
    if (idx === activeRef.current) return
    activeRef.current = idx
    setActive(idx)
  })

  const onPointerDown = (clientX: number) => {
    pointerStart.current = clientX
  }

  const onPointerUp = (clientX: number) => {
    if (pointerStart.current === null) return
    const dx = clientX - pointerStart.current
    pointerStart.current = null
    if (dx > 48) goTo(active - 1)
    else if (dx < -48) goTo(active + 1)
  }

  if (reduce) {
    return (
      <section className="coverflow coverflow--static" id="how">
        <CoverflowHeader />
        <div className="coverflow__static">
          {HOW_STEPS.map((step) => (
            <CoverCardStatic key={step.no} step={step} />
          ))}
        </div>
      </section>
    )
  }

  return (
    <section
      ref={stageRef}
      className="coverflow-stage"
      id="how"
      style={{ height: `${HOW_STEPS.length * SCROLL_VH_PER_CARD}vh` }}
      aria-label="How it works"
    >
      <div className="coverflow-stage__pin">
        <CoverflowHeader />

        <div className="coverflow__controls">
          <button
            type="button"
            className="coverflow__arrow"
            aria-label="Previous step"
            disabled={active === 0}
            onClick={() => goTo(active - 1)}
          >
            ←
          </button>
          <p className="coverflow__step-label eyebrow" aria-live="polite">
            Step <span className="tnum">{HOW_STEPS[active].no}</span> · {HOW_STEPS[active].title}
          </p>
          <button
            type="button"
            className="coverflow__arrow"
            aria-label="Next step"
            disabled={active === HOW_STEPS.length - 1}
            onClick={() => goTo(active + 1)}
          >
            →
          </button>
        </div>

        <div
          className="coverflow"
          onPointerDown={(e) => onPointerDown(e.clientX)}
          onPointerUp={(e) => onPointerUp(e.clientX)}
        >
          <div className="coverflow__floor" aria-hidden="true" />
          <div className="coverflow__scene">
            {HOW_STEPS.map((step, i) => (
              <CoverCard
                key={step.no}
                step={step}
                index={i}
                active={active}
                onSelect={() => goTo(i)}
              />
            ))}
          </div>
        </div>

        <div className="coverflow__footer">
          <CoverflowDots active={active} onSelect={goTo} />
          <ScrollProgress progress={scrollYProgress} />
        </div>
      </div>
    </section>
  )
}

function CoverflowHeader() {
  return (
    <div className="coverflow__head">
      <p className="eyebrow sect__eyebrow">How it works</p>
      <h2 className="sect__title">From failed run to confirmed fix.</h2>
    </div>
  )
}

function CoverflowDots({ active, onSelect }: { active: number; onSelect: (i: number) => void }) {
  return (
    <div className="coverflow__dots" role="tablist" aria-label="How it works steps">
      {HOW_STEPS.map((step, i) => (
        <button
          key={step.no}
          type="button"
          role="tab"
          aria-selected={i === active}
          aria-label={`Step ${step.no}: ${step.title}`}
          className={`coverflow__dot${i === active ? ' coverflow__dot--on' : ''}`}
          onClick={() => onSelect(i)}
        />
      ))}
    </div>
  )
}

function ScrollProgress({ progress }: { progress: MotionValue<number> }) {
  const [pct, setPct] = useState(0)
  useMotionValueEvent(progress, 'change', (v) => setPct(Math.round(v * 100)))

  return (
    <div className="coverflow__scroll-progress" aria-hidden="true">
      <div className="coverflow__scroll-bar" style={{ width: `${pct}%` }} />
    </div>
  )
}

function coverflowTransform(offset: number) {
  const abs = Math.abs(offset)
  if (abs > 3) {
    return { x: 0, z: 0, rotateY: 0, scale: 0.6, opacity: 0, zIndex: 0 }
  }
  return {
    x: offset * 268,
    z: -abs * 220,
    rotateY: offset * -52,
    scale: Math.max(0.76, 1 - abs * 0.1),
    opacity: Math.max(0.35, 1 - abs * 0.22),
    zIndex: 20 - abs,
  }
}

function CoverCard({
  step,
  index,
  active,
  onSelect,
}: {
  step: HowStep
  index: number
  active: number
  onSelect: () => void
}) {
  const offset = index - active
  const isCenter = offset === 0
  const t = coverflowTransform(offset)
  const abs = Math.abs(offset)

  return (
    <motion.button
      type="button"
      className={`coverflow-card coverflow-card--${step.tone}${isCenter ? ' coverflow-card--center' : ''}`}
      aria-label={`Step ${step.no}: ${step.title}`}
      aria-current={isCenter ? 'step' : undefined}
      onClick={onSelect}
      style={{ pointerEvents: abs > 2 ? 'none' : 'auto' }}
      animate={{
        x: t.x,
        z: t.z,
        rotateY: t.rotateY,
        scale: t.scale,
        opacity: t.opacity,
        zIndex: t.zIndex,
      }}
      transition={{
        opacity: { duration: 0.4, ease: [0.4, 0, 0.2, 1] },
        x: { type: 'spring', stiffness: 280, damping: 32, mass: 0.85 },
        z: { type: 'spring', stiffness: 280, damping: 32, mass: 0.85 },
        rotateY: { type: 'spring', stiffness: 280, damping: 32, mass: 0.85 },
        scale: { type: 'spring', stiffness: 280, damping: 32, mass: 0.85 },
      }}
    >
      <div className="coverflow-card__inner">
        <span className={`coverflow-card__no tnum tone--${step.tone}`}>{step.no}</span>
        <h3 className="coverflow-card__title">{step.title}</h3>
        <p className="coverflow-card__body">{step.body}</p>
        {isCenter && (
          <p className="coverflow-card__meta eyebrow">
            Dashboard frame · {step.mockupLabel}
          </p>
        )}
      </div>
    </motion.button>
  )
}

function CoverCardStatic({ step }: { step: HowStep }) {
  return (
    <article className={`coverflow-card coverflow-card--static coverflow-card--${step.tone}`}>
      <div className="coverflow-card__inner">
        <span className={`coverflow-card__no tnum tone--${step.tone}`}>{step.no}</span>
        <h3 className="coverflow-card__title">{step.title}</h3>
        <p className="coverflow-card__body">{step.body}</p>
      </div>
    </article>
  )
}
