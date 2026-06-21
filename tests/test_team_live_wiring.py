from agent.team.graph import run_team
from agent.team.scenarios import DEFAULT


def _stub_think(system, user):
    # returns canned code keyed by which signature the prompt asks for
    if "subtotal_cents" in user:
        return "def subtotal_cents(items, catalog):\n    return 42\n"
    if "discount_cents" in user:
        return "def discount_cents(subtotal, tier_rate_pct):\n    return 0\n"
    if "tax_cents" in user:
        return "def tax_cents(taxable, region_bp):\n    return 0\n"
    return None


def test_live_modules_use_the_wired_think():
    trace = run_team(DEFAULT, think=_stub_think)
    by_agent = {s.raw["agent"]: s for s in trace.steps}
    assert "return 42" in by_agent["pricing"].output["code"]      # stub Claude wrote it
    # the deterministic agents are untouched by think
    assert by_agent["architect"].output["op_order"] == "tax_first"
    assert "compute_receipt" in by_agent["integrator"].output["code"]


def test_no_think_falls_back_to_reference():
    trace = run_team(DEFAULT, think=None)
    by_agent = {s.raw["agent"]: s for s in trace.steps}
    assert "sum(catalog" in by_agent["pricing"].output["code"]    # reference module
