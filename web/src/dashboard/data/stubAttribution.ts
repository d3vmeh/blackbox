import type { Attribution } from '../../types'
import data from '../../../../shared/fixtures/flight_run/attribution.json'

// Monitor-style attribution for the LangGraph flight run (agent.flight.export_run).
export const STUB_ATTRIBUTION: Attribution = data as unknown as Attribution
