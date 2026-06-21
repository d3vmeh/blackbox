from agent.ap.export_run import build_artifacts


def test_claim_run_artifacts_are_consistent():
    art = build_artifacts()
    trace, attr, replays, monitor, meta = (
        art["trace"], art["attribution"], art["replays"], art["monitor"], art["meta"],
    )

    agents = [s["raw"]["agent"] for s in trace["steps"]]
    assert agents == ["extractor", "matcher", "fraud", "approver", "payment"]
    assert trace["id"] == "claim_run"
    assert trace["task"] == "claims-adjudication"
    assert trace["success"] is False
    assert all(s["raw"].get("runtime") == "multi-agent" for s in trace["steps"])

    assert meta["domain"] == "insurance-claims"
    assert meta["agent_labels"]["extractor"] == "INTAKE"
    assert meta["pipeline"] == ["record", "localize", "confirm", "supervise"]

    assert attr["root_step_id"] == trace["gold_root_step_id"]
    assert "42000" in attr["rationale"] or "4200" in attr["rationale"]

    root_id = attr["root_step_id"]
    decoy_id = next(k for k in replays if k != root_id)
    assert replays[root_id]["flipped"] is True
    assert replays[decoy_id]["flipped"] is False

    assert monitor["trusted"] is True
    assert monitor["decision"] == "auto_apply"
