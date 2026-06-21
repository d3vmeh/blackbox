from agent.flight.arize_export import _monitor_meta
from shared.schema import MonitorDecision, ReplayResult


def test_flight_arize_monitor_meta():
    replay = ReplayResult(
        trace_id="flight_run", step_id="s4", injected_value={"departure": "2026-07-12"},
        n=5, flipped=True, confirmation_rate=1.0, outcomes=[True] * 5,
    )
    monitor = MonitorDecision(
        trace_id="flight_run", root_step_id="s4", replay=replay,
        trusted=True, decision="auto_apply",
    )
    meta = _monitor_meta(monitor, healed=False)
    assert meta["runtime"] == "langgraph"
    assert meta["domain"] == "flight"
    assert meta["root_node"] == "parse_date"
    assert _monitor_meta(monitor, healed=True)["healed"] is True
