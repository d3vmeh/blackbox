// web/src/dashboard/RailRuns.tsx
// The agent-team RUN SWITCHER — the top of the left rail. This is where you
// switch between different agent-team runs (scenarios). A full-width trigger
// shows the current run (tier badge + label); the menu lists every run; a Run /
// Re-run button executes the picked one. Custom menu (not native <select>) so an
// overflow:hidden rail ancestor never clips it.
import { useCallback, useEffect, useRef, useState } from 'react'
import { ChevronDown, Play } from 'lucide-react'
import { SCENARIO_MANIFEST } from '../scenarios/manifest'
import './RailRuns.css'

const TIER_LABEL: Record<string, string> = {
  hero: 'Hero',
  research: 'Research',
  sponsor: 'Sponsor',
  ops: 'Ops',
  coding: 'Coding',
}

const MANIFEST_BY_ID = Object.fromEntries(SCENARIO_MANIFEST.map((s) => [s.id, s]))

// Domains are in the manifest with a tier; everything else is a live CODING-pipeline run.
const tierOf = (name: string): string => MANIFEST_BY_ID[name]?.tier ?? 'coding'
const hintOf = (name: string): string | undefined =>
  MANIFEST_BY_ID[name]?.tagline ?? (tierOf(name) === 'coding' ? 'live real-LLM coding pipeline' : undefined)

export interface RailRunsProps {
  scenarios: { name: string; label: string }[]
  picked: string
  loaded: string
  onPick: (name: string) => void
  onRun: () => void
  loading: boolean
  error: string | null
}

export function RailRuns({ scenarios, picked, loaded, onPick, onRun, loading, error }: RailRunsProps) {
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)
  const pickedLabel = scenarios.find((s) => s.name === picked)?.label ?? picked
  const pending = picked !== loaded

  const close = useCallback(() => setOpen(false), [])

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

        {open && (
          <ul className="rruns__menu" role="listbox" aria-label="Agent-team runs">
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
