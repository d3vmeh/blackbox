from agent.code_graph import run_code
from agent.code_monitor import investigate
from agent.code_scenarios import SCENARIOS, CodeScenario

PARSE = next(s for s in SCENARIOS if s.name == "parse_duration_units")

def test_clean_run_reports_no_failure():
    clean = CodeScenario(PARSE.name, PARSE.requirement, PARSE.reference, PARSE.acceptance_tests, fault=None)
    v = investigate(run_code(clean), clean)
    assert v.failed is False

def test_localizes_spec_interpreter_and_replay_confirms():
    v = investigate(run_code(PARSE), PARSE)
    assert v.failed is True
    assert v.root_agent == "spec_interpreter"              # earliest flip, not implementer
    assert v.replay_confirmed is True
    assert v.confirmation_rate == 1.0
