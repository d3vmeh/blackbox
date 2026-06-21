import type { Trace } from '../../types'
import fixture from '../../../../shared/fixtures/flight_fail.json'

export function loadFixtureTrace(): Trace {
  return fixture as unknown as Trace
}
