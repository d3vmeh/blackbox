// web/src/dashboard/TrustBadge.tsx
// The oracle's trust readout in the readout bar. Three states (DESIGN.md):
//   untrusted = neutral text + dashed --line border, NO signal hue
//   proving   = neutral + a live k/n replay counter
//   trusted   = --pass text + --ring-pass (the lone signal use — the confirmed fix)
// The lucide icon is NEUTRAL affordance only; state is carried by treatment, never
// by icon color. Honors prefers-reduced-motion (no scale-in via CSS).
import { Shield } from 'lucide-react'
import type { TrustState } from './types'
import './TrustBadge.css'

const LABEL: Record<TrustState, string> = {
  untrusted: 'UNTRUSTED',
  proving: 'PROVING',
  trusted: 'TRUSTED',
}

/**
 * `rate` is a 0..1 confirmation rate; with `n` it yields the k/n counter shown
 * while proving. Explicit counts win; otherwise k = round(rate * n).
 */
export function TrustBadge({ state, rate, n }: { state: TrustState; rate?: number; n?: number }) {
  const total = n ?? 0
  const passed = total > 0 ? Math.round((rate ?? 0) * total) : 0

  return (
    <span className="trust-badge" data-state={state}>
      <Shield
        className="trust-badge__icon"
        size={16}
        strokeWidth={1.5}
        aria-hidden="true"
      />
      <span className="trust-badge__label">{LABEL[state]}</span>
      {state === 'proving' && total > 0 && (
        <span className="trust-badge__count" aria-label={`${passed} of ${total} replays`}>
          {passed}/{total}
        </span>
      )}
    </span>
  )
}
