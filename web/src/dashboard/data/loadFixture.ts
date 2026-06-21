import type { Trace } from '../../types'
import fixture from '../../../../shared/fixtures/claim_run/trace.json'

export function loadFixtureTrace(): Trace {
  return fixture as unknown as Trace
}
