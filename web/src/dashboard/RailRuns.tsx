// web/src/dashboard/RailRuns.tsx
// The agent-team RUN SWITCHER — the top of the left rail. This is where you
// switch between different agent-team runs (scenarios). A full-width trigger
// shows the current run (tier badge + label); the menu lists every run; a Run /
// Re-run button executes the picked one. Custom menu (not native <select>) so an
// overflow:hidden rail ancestor never clips it.
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { ChevronDown, Play } from 'lucide-react'
import { SCENARIO_MANIFEST } from '../scenarios/manifest'
import './RailRuns.css'

const TIER_LABEL: Record<string, string> = {
  hero: 'Hero',
  research: 'Research',
  sponsor: 'Sponsor',
  ops: 'Ops',
  coding: 'Coding',
  team: 'Software',
}

const TIER_HINT: Record<string, string> = {
  coding: 'live real-LLM coding pipeline',
  team: 'live real-LLM software team',
}

const MANIFEST_BY_ID = Object.fromEntries(SCENARIO_MANIFEST.map((s) => [s.id, s]))

// Domains are in the manifest with a tier; the billing subject is the software-team pipeline;
// everything else is a live CODING-pipeline scenario.
const tierOf = (name: string): string =>
  MANIFEST_BY_ID[name]?.tier ?? (name.startsWith('billing') ? 'team' : 'coding')
const hintOf = (name: string): string | undefined =>
  MANIFEST_BY_ID[name]?.tagline ?? TIER_HINT[tierOf(name)]

export interface RailRunsProps {
  scenarios: { name: string; label: string }[]
  picked: string
  loaded: string
  onPick: (name: string) => void
  onRun: () => void
  loading: boolean
  error: string | null
}

interface MenuPos {
  top: number
  left: number
  width: number
}

export function RailRuns({ scenarios, picked, loaded, onPick, onRun, loading, error }: RailRunsProps) {
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)
  // The menu is position:fixed and anchored to the trigger so it can be wider than
  // the narrow rail without extending the rail's overflow:auto scroll width.
  const [menuPos, setMenuPos] = useState<MenuPos | null>(null)
  const pickedLabel = scenarios.find((s) => s.name === picked)?.label ?? picked
  const pending = picked !== loaded

  const close = useCallback(() => setOpen(false), [])

  useLayoutEffect(() => {
    // Closed: leave the last position in place (the menu only renders when open) and
    // re-measure before paint on the next open — no synchronous reset needed here.
    if (!open) return
    const place = () => {
      const t = triggerRef.current
      if (!t) return
      const r = t.getBoundingClientRect()
      const gap = 4 // var(--space-1)
      const width = Math.min(360, window.innerWidth - r.left - 8)
      const next = { top: r.bottom + gap, left: r.left, width }
      setMenuPos((prev) =>
        prev && prev.top === next.top && prev.left === next.left && prev.width === next.width ? prev : next,
      )
    }
    place()
    window.addEventListener('resize', place)
    window.addEventListener('scroll', place, true) // capture: catch the rail's own scroll
    return () => {
      window.removeEventListener('resize', place)
      window.removeEventListener('scroll', place, true)
    }
  }, [open])

  useEffect(() => {
    if (!open) return
    const onDoc = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) close()
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close()
    }
    document.addEventListener('mousedown', onDoc)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDoc)
      document.removeEventListener('keydown', onKey)
    }
  }, [open, close])

  return (
    <section className="rruns" ref={rootRef}>
      <span className="rruns__eyebrow">Agent-team run</span>

      <div className="rruns__pick">
        <button
          ref={triggerRef}
          type="button"
          className="rruns__trigger"
          aria-haspopup="listbox"
          aria-expanded={open}
          aria-label="Choose scenario"
          onClick={() => setOpen((v) => !v)}
        >
          <span className="rruns__trigger-text">
            <span className={`rruns__tier rruns__tier--${tierOf(picked)}`}>
              {TIER_LABEL[tierOf(picked)] ?? tierOf(picked)}
            </span>
            <span className="rruns__name">{pickedLabel}</span>
          </span>
          <ChevronDown className="rruns__chev" aria-hidden="true" size={14} strokeWidth={1.75} />
        </button>

        {open && menuPos && (
          <ul
            className="rruns__menu"
            role="listbox"
            aria-label="Agent-team runs"
            style={{ top: menuPos.top, left: menuPos.left, width: menuPos.width }}
          >
            {scenarios.map((s) => {
              const tier = tierOf(s.name)
              const hint = hintOf(s.name)
              const active = s.name === picked
              return (
                <li key={s.name} role="option" aria-selected={active}>
                  <button
                    type="button"
                    className={`rruns__opt${active ? ' rruns__opt--active' : ''}`}
                    onClick={() => { onPick(s.name); close() }}
                  >
                    <span className={`rruns__tier rruns__tier--${tier}`}>
                      {TIER_LABEL[tier] ?? tier}
                    </span>
                    <span className="rruns__opt-body">
                      <span className="rruns__opt-label">{s.label}</span>
                      {hint && <span className="rruns__opt-hint">{hint}</span>}
                    </span>
                  </button>
                </li>
              )
            })}
          </ul>
        )}
      </div>

      <button type="button" className="rruns__run" onClick={onRun} disabled={loading}>
        <Play size={13} strokeWidth={2} aria-hidden="true" />
        {loading ? 'Running…' : pending ? 'Run scenario' : 'Re-run'}
      </button>

      {pending && !loading && (
        <span className="rruns__status rruns__status--ready">Not loaded — press Run</span>
      )}
      {error && <span className="rruns__status rruns__status--err">{error}</span>}
    </section>
  )
}
