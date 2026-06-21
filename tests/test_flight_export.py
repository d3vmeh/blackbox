from agent.flight.export_run import build_artifacts


def test_flight_run_artifacts_are_consistent():
    art = build_artifacts()
    trace, attr, replays, meta = art["trace"], art["attribution"], art["replays"], art["meta"]

    nodes = [s["raw"]["node"] for s in trace["steps"]]
    assert nodes[0] == "plan"
    assert "parse_date" in nodes
    assert trace["id"] == "flight_run"
    assert trace["success"] is False
    assert trace["gold_root_step_id"] == "s4"
    assert all(s["raw"].get("runtime") == "langgraph" for s in trace["steps"])

    assert meta["runtime"] == "langgraph"
    assert "run_agent_graph" in meta["apis"]
    assert "to_trace" in meta["apis"]
    assert meta["fork_node"] == "parse_date"
    assert meta["checkpoints"] >= 8

    assert attr["trace_id"] == "flight_run"
    assert attr["root_step_id"] == "s4"
    assert "2026-12-07" in attr["rationale"]

    assert replays["s4"]["flipped"] is True
    assert replays["s4"]["confirmation_rate"] == 1.0
    assert replays["s5"]["flipped"] is False
