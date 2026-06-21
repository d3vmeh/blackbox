from agent.flight.export_run import build_artifacts


def test_flight_run_artifacts_are_consistent():
    art = build_artifacts()
    trace, attr, replays, monitor, meta = (
        art["trace"], art["attribution"], art["replays"], art["monitor"], art["meta"],
    )

    nodes = [s["raw"]["node"] for s in trace["steps"]]
    assert nodes[0] == "plan"
    assert "parse_date" in nodes
    assert trace["id"] == "flight_run"
    assert trace["success"] is False
    assert trace["gold_root_step_id"] == "s4"
    assert all(s["raw"].get("runtime") == "langgraph" for s in trace["steps"])

    assert meta["runtime"] == "langgraph"
    assert meta["pipeline"] == ["record", "localize", "confirm", "supervise"]
    assert "run_agent_graph" in meta["apis"]
    assert meta["fork_node"] == "parse_date"
    assert meta["checkpoints"] >= 8

    assert attr["root_step_id"] == "s4"
    assert "2026-12-07" in attr["rationale"]

    assert replays["s4"]["flipped"] is True
    assert replays["s5"]["flipped"] is False

    assert monitor["trusted"] is True
    assert monitor["decision"] == "auto_apply"
    assert monitor["replay"]["step_id"] == "s4"
