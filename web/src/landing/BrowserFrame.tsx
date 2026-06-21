import type { ReactNode } from 'react'
import './browserframe.css'

interface BrowserFrameProps {
  url: string
  children: ReactNode
}

/**
 * Realistic browser-window chrome so the embedded app reads as the real product.
 * Window controls are intentionally NEUTRAL (not macOS red/yellow/green) so the
 * three reserved signal hues stay exclusive to the trace.
 */
export function BrowserFrame({ url, children }: BrowserFrameProps) {
  return (
    <div className="frame">
      <div className="frame__bar">
        <div className="frame__dots" aria-hidden="true">
          <span /><span /><span />
        </div>
        <div className="frame__url">
          <span className="frame__lock" aria-hidden="true" />
          <span className="frame__urltext tnum">{url}</span>
        </div>
        <div className="frame__spacer" />
      </div>
      <div className="frame__body">{children}</div>
    </div>
  )
}
