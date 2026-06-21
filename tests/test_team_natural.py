from agent.team.export_run import build_artifacts
from agent.team.graph import run_team
from agent.team.scenarios import SCENARIOS

NATURAL = next(s for s in SCENARIOS if s.name == "billing_tax_rounding_natural")


def _bankers_think(system, user):
    """Stub Claude: writes a banker's-rounding tax module (the natural bug); other agents -> reference."""
    if "tax_cents" in user:
        return "def tax_cents(taxable, region_bp):\n    return round(taxable * region_bp / 10000)\n"
    return None


def _halfup_think(system, user):
    if "tax_cents" in user:
        return ("from math import floor\n"
                "def tax_cents(taxable, region_bp):\n    return floor(taxable * region_bp / 10000 + 0.5)\n")
    return None


def test_natural_fails_live_but_passes_deterministic():
    # live (stub) -> tax banker's-rounds the half-cent case -> fail; offline -> reference half-up -> pass
    assert run_team(NATURAL, think=_bankers_think).success is False
    assert run_team(NATURAL, think=None).success is True


def test_natural_localizes_to_the_tax_module():
    art = build_artifacts(NATURAL, think=_bankers_think)
    trace, attr = art["trace"], art["attribution"]
    root = next(s for s in trace["steps"] if s["id"] == attr["root_step_id"])
    assert root["raw"]["agent"] == "tax"
    assert root["is_injected_fault"] is False            # genuinely natural — nothing injected
    assert trace["gold_root_step_id"] == root["id"]
    assert art["replays"][root["id"]]["flipped"] is True
    assert art["monitor"]["trusted"] is True
    assert "natural failure" in art["meta"]["domain"]
    # honest blast: integrator downstream is poisoned; the correct sibling modules are NOT
    by_agent = {s["raw"]["agent"]: s["id"] for s in trace["steps"]}
    assert by_agent["integrator"] in attr["blast_radius"]
    assert by_agent["pricing"] not in attr["blast_radius"]


def test_natural_rationale_has_no_raw_code_blob():
    art = build_artifacts(NATURAL, think=_bankers_think)
    assert "\\n" not in art["attribution"]["rationale"]
    assert "def tax_cents" not in art["attribution"]["candidates"][0]["reason"]
    # the fix (corrected module source) is carried for the SplitCompare diff
    assert "floor" in art["attribution"]["suggested_fix"]["code"]


def test_natural_clean_run_has_no_root():
    # if the model happens to round correctly, there is no failure to localize (re-run to surface)
    art = build_artifacts(NATURAL, think=_halfup_think)
    assert art["attribution"]["root_step_id"] == ""
    assert art["replays"] == {}
