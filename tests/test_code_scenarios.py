from agent.code.scenarios import SCENARIOS, CodeScenario, CodeFault, AGENTS

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

def test_celsius_task_has_spec_and_impl_faults():
    names = {s.name for s in SCENARIOS}
    assert {"celsius_spec", "celsius_impl"} <= names
    spec = next(s for s in SCENARIOS if s.name == "celsius_spec")
    impl = next(s for s in SCENARIOS if s.name == "celsius_impl")
    assert spec.function_name == "celsius_to_fahrenheit"
    assert spec.fault.agent == "spec_interpreter"
    assert impl.fault.agent == "implementer"

def test_kib_task_has_spec_and_impl_faults_and_total_is_ten():
    names = {s.name for s in SCENARIOS}
    assert {"kib_spec", "kib_impl"} <= names
    assert next(s for s in SCENARIOS if s.name == "kib_spec").function_name == "kib"
    assert len(SCENARIOS) == 10       # 3 parse + 2 celsius + 2 kib + 2 merge_intervals + 1 natural


def test_natural_scenario_has_no_injected_fault():
    nat = next(s for s in SCENARIOS if s.name == "round_half_natural")
    assert nat.natural is True
    assert nat.fault is None          # the bug is the live LLM's own, not injected
    assert nat.function_name == "round_half"


def test_merge_intervals_task_present_with_spec_and_impl_faults():
    by = {s.name: s for s in SCENARIOS}
    assert {"merge_intervals_spec", "merge_intervals_impl"} <= set(by)
    assert by["merge_intervals_spec"].function_name == "merge_intervals"
    assert by["merge_intervals_spec"].fault.agent == "spec_interpreter"
    assert by["merge_intervals_impl"].fault.agent == "implementer"
