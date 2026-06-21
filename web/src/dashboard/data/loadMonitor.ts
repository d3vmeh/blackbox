import type { MonitorDecision } from '../../types'
import data from '../../../../shared/fixtures/claim_adjudication/monitor.json'

export function loadMonitorDecision(): MonitorDecision {
  return data as unknown as MonitorDecision
}
