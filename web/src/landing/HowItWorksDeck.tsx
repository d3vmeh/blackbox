import {
  motion,
  useMotionValueEvent,
  useReducedMotion,
  useScroll,
  useTransform,
  type MotionValue,
} from 'motion/react'
import { useRef, useState } from 'react'
import { HOW_STEPS, type HowStep } from './howSteps'

/** ~72vh per card — slow enough to read each step. */
const SCROLL_VH_PER_CARD = 72
const SCROLL_VH = HOW_STEPS.length * SCROLL_VH_PER_CARD

export function HowItWorksDeck() {
  const stageRef = useRef<HTMLElement>(null)
  const reduce = useReducedMotion()

  const { scrollYProgress } = useScroll({
    target: stageRef,
    offset: ['start start', 'end end'],
  })

  if (reduce) {
    return (
      <section className="how" id="how">
        <p className="eyebrow sect__eyebrow">How it works</p>
        <h2 className="sect__title">From failed run to confirmed fix.</h2>
        <div className="how-deck__static">
          {HOW_STEPS.map((s) => (
            <DeckCardStatic key={s.no} step={s} />
          ))}
        </div>
      </section>
    )
  }

  return (
    <section
      ref={stageRef}
      className="how-deck"
      id="how"
      style={{ height: `${SCROLL_VH}vh` }}
      aria-label="How it works"
    >
      <div className="how-deck__pin">
        <div className="how-deck__head">
          <p className="eyebrow sect__eyebrow">How it works</p>
          <h2 className="sect__title how-deck__title">From failed run to confirmed fix.</h2>
          <DeckStepLabel progress={scrollYProgress} total={HOW_STEPS.length} />
        </div>

        <div className="how-deck__stack-wrap">
          <div className="how-deck__stack">
            {HOW_STEPS.map((step, i) => (
              <DeckCard
                key={step.no}
                step={step}
                index={i}
                total={HOW_STEPS.length}
                progress={scrollYProgress}
              />
            ))}
          </div>
        </div>

        <DeckProgress progress={scrollYProgress} total={HOW_STEPS.length} />
      </div>
    </section>
  )
}

function DeckStepLabel({ progress, total }: { progress: MotionValue<number>; total: number }) {
  const [step, setStep] = useState(HOW_STEPS[0])

  useMotionValueEvent(progress, 'change', (v) => {
    const idx = Math.min(Math.floor(v * total * 0.999), total - 1)
    setStep(HOW_STEPS[idx])
  })

  return (
    <p className="how-deck__step-label eyebrow" aria-live="polite">
      Step <span className="tnum">{step.no}</span> · {step.title}
    </p>
  )
}

function DeckProgress({ progress, total }: { progress: MotionValue<number>; total: number }) {
  const [active, setActive] = useState(0)

  useMotionValueEvent(progress, 'change', (v) => {
    setActive(Math.min(Math.floor(v * total * 0.999), total - 1))
  })

  return (
    <div className="how-deck__progress" aria-hidden="true">
      {HOW_STEPS.map((s, i) => (
        <span key={s.no} className={`how-deck__dot${i === active ? ' how-deck__dot--on' : ''}`} />
      ))}
    </div>
  )
}

function DeckCard({
  step,
  index,
  total,
  progress,
}: {
  step: HowStep
  index: number
  total: number
  progress: MotionValue<number>
}) {
  const exitCount = total - 1
  const segment = 0.88 / exitCount
  const start = index * segment
  const end = (index + 1) * segment
  const isLast = index >= exitCount

  const exit = useTransform(progress, (v) => {
    if (isLast) return 0
    if (v <= start) return 0
    if (v >= end) return 1
    return (v - start) / (end - start)
  })

  /* Peel from lower-right toward upper-left. */
  const x = useTransform(exit, (e) => (isLast ? 0 : e * -72))
  const y = useTransform(exit, (e) => (isLast ? 0 : e * -96))
  const rotate = useTransform(exit, (e) => (isLast ? 0 : e * -10))
  const opacity = useTransform(exit, (e) => (isLast ? 1 : Math.max(0, 1 - e * 1.05)))

  return (
    <motion.article
      className={`deck-card deck-card--${step.tone}`}
      style={{
        x,
        y,
        rotate,
        opacity,
        zIndex: total - index,
      }}
      aria-label={`Step ${step.no}: ${step.title}`}
    >
      <span className={`deck-card__no tnum tone--${step.tone}`}>{step.no}</span>
      <h3 className="deck-card__title">{step.title}</h3>
      <p className="deck-card__body">{step.body}</p>
    </motion.article>
  )
}

function DeckCardStatic({ step }: { step: HowStep }) {
  return (
    <article className={`deck-card deck-card--static deck-card--${step.tone}`}>
      <span className={`deck-card__no tnum tone--${step.tone}`}>{step.no}</span>
      <h3 className="deck-card__title">{step.title}</h3>
      <p className="deck-card__body">{step.body}</p>
    </article>
  )
}
