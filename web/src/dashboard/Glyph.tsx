// web/src/dashboard/Glyph.tsx
// Status-ring glyph (DESIGN.md): state by SHAPE + FILL, never color alone.
// pending = faint hollow ring · active = partial pie · done = filled ring + check.
// Neutral affordance by default; `tone="root"` is the lone exception (it marks the
// localized root cause, per the color-mapping rule).
import './dashboard.css'

export type GlyphState = 'pending' | 'active' | 'done'
export type GlyphTone = 'neutral' | 'root' | 'pass'

export function Glyph({ state, tone = 'neutral' }: { state: GlyphState; tone?: GlyphTone }) {
  return (
    <svg className="glyph" data-tone={tone} viewBox="0 0 16 16" aria-hidden="true" focusable="false">
      {state === 'pending' && (
        <circle cx="8" cy="8" r="6" className="glyph__ring" strokeDasharray="2.2 2.4" />
      )}
      {state === 'active' && (
        <>
          <circle cx="8" cy="8" r="6" className="glyph__ring" />
          {/* half pie — a localization in progress */}
          <path d="M8 8 L8 2 A6 6 0 0 1 14 8 Z" className="glyph__fill" />
        </>
      )}
      {state === 'done' && (
        <>
          <circle cx="8" cy="8" r="6.5" className="glyph__disc" />
          <path d="M5 8.2 L7 10.2 L11 5.8" className="glyph__check" />
        </>
      )}
    </svg>
  )
}
