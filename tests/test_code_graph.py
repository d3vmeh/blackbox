from agent.code.graph import run_code
from agent.code.scenarios import SCENARIOS, CodeScenario

PARSE = next(s for s in SCENARIOS if s.name == "parse_duration_units")

def _clean(scn) -> CodeScenario:
    return CodeScenario(scn.name, scn.requirement, scn.reference, scn.acceptance_tests, fault=None)

def test_trace_has_four_agent_steps_in_order():
    t = run_code(_clean(PARSE))
    agents = [s.raw["agent"] for s in t.steps]
    assert agents == ["spec_interpreter", "implementer", "test_writer", "reviewer"]

def test_parents_are_true_dataflow_edges():
    t = run_code(_clean(PARSE))
    by_agent = {s.raw["agent"]: s for s in t.steps}
    spec = by_agent["spec_interpreter"]
    impl = by_agent["implementer"]
    assert spec.parents == []
    assert impl.parents == [spec.id]                       # implementer reads the spec

def test_clean_run_passes_oracle():
    t = run_code(_clean(PARSE))
    assert t.success is True

def test_faulted_run_fails_oracle_and_flags_spec():
    t = run_code(PARSE)                                    # fault at spec_interpreter
    assert t.success is False
    spec = next(s for s in t.steps if s.raw["agent"] == "spec_interpreter")
    assert spec.is_injected_fault is True
    assert spec.output["unit"] == "minutes"               # the corruption is visible
