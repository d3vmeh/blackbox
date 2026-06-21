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

def test_clean_scenario_yields_empty_attribution():
    from agent.code.scenarios import SCENARIOS
    clean = next(s for s in SCENARIOS if s.name == "parse_duration_clean")
    art = build_artifacts(clean)
    assert art["trace"]["success"] is True
    assert art["attribution"]["root_step_id"] == ""      # no fault → empty-but-valid attribution
    assert art["attribution"]["blast_radius"] == []
    assert art["replays"] == {}

def test_build_artifacts_accepts_think_none_explicitly():
    art = build_artifacts(DEFAULT, think=None)
    assert art["attribution"]["root_step_id"] == "s1"
