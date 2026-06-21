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
