from agent.team.scenarios import (AGENTS, DEFAULT, KIND, PARENTS, RUN_ORDER,
                                   SCENARIOS, TeamFault)


def _build_up(scn):
    up = {}
    for a in AGENTS:
        up[a] = scn.reference[a](scn, up)
    return up


def test_agents_and_dag_shape():
    assert AGENTS == ["architect", "pricing", "discount", "tax",
                      "integrator", "test_writer", "reviewer", "ci"]
    assert PARENTS["integrator"] == ["pricing", "discount", "tax", "architect"]
    assert PARENTS["architect"] == []
    assert KIND["ci"] == "final"
    # the 3 leaf modules run as a parallel group
    assert ("pricing", "discount", "tax") in RUN_ORDER


def test_reference_is_internally_correct():
    up = _build_up(DEFAULT)
    assert up["architect"]["op_order"] == "discount_first"
    # the integrator picks the correct receipt when the contract says discount_first
    assert "taxable = subtotal - discount" in up["integrator"]["code"]


def test_integrator_follows_a_tax_first_contract():
    scn = DEFAULT
    up = {"architect": {**scn.reference["architect"](scn, {}), "op_order": "tax_first"}}
    code = scn.reference["integrator"](scn, up)["code"]
    assert "tax = tax_cents(subtotal" in code   # taxes the full subtotal


def test_default_scenario_injects_op_order_fault():
    assert DEFAULT.fault == TeamFault("architect", "op_order", "tax_first")
    assert DEFAULT.decision_fields["architect"] == ["op_order", "money_unit", "rounding"]
    assert DEFAULT in SCENARIOS
