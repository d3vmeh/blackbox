import type { Attribution } from '../../types'

// Forward slice from s3 over the fixture's real parents edges (the wrong date's reach).
export const STUB_ATTRIBUTION: Attribution = {
  trace_id: 'trace_flight_fail_001',
  root_step_id: 's3',
  blast_radius: [
    's4', 's7', 's8', 's9', 's10', 's11', 's12', 's13', 's14', 's15', 's16',
    's17', 's18', 's19', 's20', 's21', 's22', 's23', 's24', 's25', 's26',
    's27', 's28', 's29',
  ],
  candidates: [
    { step_id: 's3', suspicion: 0.91, reason: 'date parsed DD-MM: "July 12" → 2024-12-07 (month/day swapped)' },
    { step_id: 's14', suspicion: 0.42, reason: 'relaxed the direct-only constraint to meet budget' },
    { step_id: 's21', suspicion: 0.18, reason: 'verified the fare against its own (wrong) resolved date' },
  ],
  rationale:
    'Step s3 transposed day and month when normalizing the departure date; every downstream booking step inherited 2024-12-07.',
}
