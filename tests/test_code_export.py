from agent.code.export_run import build_artifacts
from agent.code.scenarios import DEFAULT

def test_artifacts_are_consistent_and_correct():
    art = build_artifacts(DEFAULT)
    trace, attr, replays = art["trace"], art["attribution"], art["replays"]

    # trace: the 4-agent coding run
    agents = [s["raw"]["agent"] for s in trace["steps"]]
    assert agents == ["spec_interpreter", "implementer", "test_writer", "reviewer"]
    assert trace["id"] == "code_run"
    assert trace["success"] is False

    # attribution: root = spec_interpreter (s1), blast = the downstream steps
    assert attr["trace_id"] == "code_run"
    assert attr["root_step_id"] == "s1"
    assert set(attr["blast_radius"]) == {"s2", "s3", "s4"}
    assert attr["candidates"][0]["step_id"] == "s1"          # top suspect is the root
    assert "minutes" in attr["rationale"] and "seconds" in attr["rationale"]

    # replays: root (s1) flips FAIL->PASS; decoy (s3 test_writer) does not
    assert replays["s1"]["flipped"] is True
    assert replays["s1"]["confirmation_rate"] == 1.0
    assert replays["s3"]["flipped"] is False
