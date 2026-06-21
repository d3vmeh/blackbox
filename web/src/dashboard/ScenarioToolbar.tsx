import { useCallback, useEffect, useRef, useState } from 'react'
import { ChevronDown, Play } from 'lucide-react'
import { SCENARIO_MANIFEST } from '../scenarios/manifest'
import './ScenarioToolbar.css'

const TIER_LABEL: Record<string, string> = {
  hero: 'Hero',
  research: 'Research',
  sponsor: 'Sponsor',
  ops: 'Ops',
  coding: 'Coding',
}

const MANIFEST_BY_ID = Object.fromEntries(SCENARIO_MANIFEST.map((s) => [s.id, s]))

// Domains are in the manifest with a tier; everything else is a live CODING-pipeline scenario.
const tierOf = (name: string): string => MANIFEST_BY_ID[name]?.tier ?? 'coding'
const hintOf = (name: string): string | undefined =>
  MANIFEST_BY_ID[name]?.tagline ?? (tierOf(name) === 'coding' ? 'live real-LLM coding pipeline' : undefined)

export interface ScenarioToolbarProps {
  scenarios: { name: string; label: string }[]
  picked: string
  loaded: string
  onPick: (name: string) => void
  onRun: () => void
  loading: boolean
  error: string | null
}

export function ScenarioToolbar({
  scenarios,
  picked,
  loaded,
  onPick,
  onRun,
  loading,
  error,
}: ScenarioToolbarProps) {
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
    <div className="scn-bar" ref={rootRef}>
      <span className="scn-bar__label">Scenario</span>

      <div className="scn-bar__pick">
        <button
          type="button"
          className="scn-bar__trigger"
          aria-haspopup="listbox"
          aria-expanded={open}
          aria-label="Choose scenario"
          onClick={() => setOpen((v) => !v)}
        >
          <span className="scn-bar__trigger-text">
            <span className={`scn-bar__tier scn-bar__tier--${tierOf(picked)}`}>
              {TIER_LABEL[tierOf(picked)] ?? tierOf(picked)}
            </span>
            <span className="scn-bar__name">{pickedLabel}</span>
          </span>
          <ChevronDown className="scn-bar__chev" aria-hidden="true" size={14} strokeWidth={1.75} />
        </button>

        {open && (
          <ul className="scn-bar__menu" role="listbox" aria-label="Scenarios">
            {scenarios.map((s) => {
              const tier = tierOf(s.name)
              const hint = hintOf(s.name)
              const active = s.name === picked
              return (
                <li key={s.name} role="option" aria-selected={active}>
                  <button
                    type="button"
                    className={`scn-bar__opt${active ? ' scn-bar__opt--active' : ''}`}
                    onClick={() => { onPick(s.name); close() }}
                  >
                    <span className={`scn-bar__tier scn-bar__tier--${tier}`}>
                      {TIER_LABEL[tier] ?? tier}
                    </span>
                    <span className="scn-bar__opt-body">
                      <span className="scn-bar__opt-label">{s.label}</span>
                      {hint && <span className="scn-bar__opt-hint">{hint}</span>}
                    </span>
                  </button>
                </li>
              )
            })}
          </ul>
        )}
      </div>

      <button
        type="button"
        className="scn-bar__run"
        onClick={onRun}
        disabled={loading}
      >
        <Play size={13} strokeWidth={2} aria-hidden="true" />
        {loading ? 'Running…' : pending ? 'Run scenario' : 'Re-run'}
      </button>

      {pending && !loading && (
        <span className="scn-bar__status scn-bar__status--ready">Not loaded — press Run</span>
      )}
      {error && <span className="scn-bar__status scn-bar__status--err">{error}</span>}
    </div>
  )
}
