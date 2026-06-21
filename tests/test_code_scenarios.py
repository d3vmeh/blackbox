from agent.code_scenarios import SCENARIOS, CodeScenario, CodeFault, AGENTS

def test_one_scenario_named_parse_duration_seconds():
    names = [s.name for s in SCENARIOS]
    assert "parse_duration_units" in names

def test_reference_agents_cover_all_four():
    scn = next(s for s in SCENARIOS if s.name == "parse_duration_units")
    assert AGENTS == ["spec_interpreter", "implementer", "test_writer", "reviewer"]
    up = {}
    for a in AGENTS:
        out = scn.reference[a](scn, up)
        assert isinstance(out, dict)
        up[a] = out
    # correct spec → seconds; correct implementer code computes total seconds
    assert up["spec_interpreter"]["unit"] == "seconds"
    assert "def parse_duration" in up["implementer"]["code"]

def test_fault_is_spec_unit_minutes():
    scn = next(s for s in SCENARIOS if s.name == "parse_duration_units")
    assert scn.fault == CodeFault("spec_interpreter", "unit", "minutes")

def test_scenarios_include_parse_impl_fault_and_clean():
    names = {s.name for s in SCENARIOS}
    assert "parse_duration_impl" in names
    assert "parse_duration_clean" in names

def test_parse_impl_fault_is_at_implementer():
    scn = next(s for s in SCENARIOS if s.name == "parse_duration_impl")
    assert scn.fault.agent == "implementer"
    assert scn.fault.field == "code"

def test_parse_clean_has_no_fault():
    scn = next(s for s in SCENARIOS if s.name == "parse_duration_clean")
    assert scn.fault is None
