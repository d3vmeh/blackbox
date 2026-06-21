import type { Trace } from '../../types'
import fixture from '../../../../shared/fixtures/code_run/trace.json'

export function loadFixtureTrace(): Trace {
  return fixture as unknown as Trace
}
