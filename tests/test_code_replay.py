from agent.code_graph import replay_code
from agent.code_scenarios import SCENARIOS

PARSE = next(s for s in SCENARIOS if s.name == "parse_duration_units")

def test_baseline_replay_still_fails():
    t = replay_code(PARSE, None, None)                     # no correction → still broken
    assert t.success is False

def test_injecting_correct_spec_flips_to_pass():
    t = replay_code(PARSE, "spec_interpreter", {"unit": "seconds"})
    assert t.success is True                                # corrected spec → correct code → PASS
