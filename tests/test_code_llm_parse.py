from agent.code_graph import _apply_think
from agent.code_scenarios import SCENARIOS

PARSE = next(s for s in SCENARIOS if s.name == "parse_duration_units")

def test_think_none_keeps_reference():
    base = {"unit": "seconds"}
    assert _apply_think(None, "spec_interpreter", PARSE, {}, base) == base

def test_think_text_overrides_unit_field():
    fake = lambda system, user: "minutes"                  # model "decides" minutes
    out = _apply_think(fake, "spec_interpreter", PARSE, {}, {"unit": "seconds"})
    assert out["unit"] == "minutes"
