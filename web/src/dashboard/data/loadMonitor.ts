import type { MonitorDecision } from '../../types'
import data from '../../../../shared/fixtures/flight_run/monitor.json'

export function loadMonitorDecision(): MonitorDecision {
  return data as unknown as MonitorDecision
}
