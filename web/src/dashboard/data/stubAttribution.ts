import type { Attribution } from '../../types'
import data from '../../../../shared/fixtures/claim_adjudication/attribution.json'

// Monitor-style attribution for the insurance claims run (agent.ap.export_run).
export const STUB_ATTRIBUTION: Attribution = data as unknown as Attribution
