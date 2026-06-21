"""P1 — Team-pipeline scenarios. One billing task; per-agent REFERENCE outputs
(deterministic functions of upstream — the no-key fallback AND the answer key), a hidden
acceptance suite (the oracle), and a fault injected at one agent/field. Mirrors
agent/code/scenarios.py, extended to a fan-out DAG (3 parallel module implementers)."""
from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any, Optional

from .source import (ACCEPTANCE, CONTRACT_CODE, DISCOUNT_CODE, PRICING_CODE,
                     RECEIPT_DISCOUNT_FIRST, RECEIPT_TAX_FIRST, TAX_CODE)

AGENTS = ["architect", "pricing", "discount", "tax",
          "integrator", "test_writer", "reviewer", "ci"]

PARENTS: dict[str, list[str]] = {
    "architect": [],
    "pricing": ["architect"],
    "discount": ["architect"],
    "tax": ["architect"],
    "integrator": ["pricing", "discount", "tax", "architect"],
    "test_writer": ["architect"],
    "reviewer": ["integrator", "test_writer", "architect"],
    "ci": ["integrator", "reviewer"],
}
KIND = {a: "decision" for a in AGENTS}
KIND["ci"] = "final"

# execution order; the inner tuple = the 3 implementers run in parallel (real fan-out)
RUN_ORDER: tuple = ("architect", ("pricing", "discount", "tax"),
                    "integrator", "test_writer", "reviewer", "ci")


@dataclass(frozen=True)
class TeamFault:
    agent: str
    field: str
    bad_value: Any


@dataclass
class TeamScenario:
    name: str
    reference: dict                      # agent -> fn(scn, up) -> output dict
    acceptance_tests: str                # hidden asserts over compute_receipt
    decision_fields: dict[str, list[str]]  # agent -> constrained fields localize may compare
    fault: Optional[TeamFault] = None
    natural: bool = False
    # agent -> (signature, summary) for the live (real-Claude) implementation of that agent;
    # consulted by graph._llm_module only when a `think` is wired. Empty = fully deterministic.
    live: dict = field(default_factory=dict)


def _ref_architect(scn, up):
    return {"op_order": "discount_first", "money_unit": "cents", "rounding": "round_half_up",
            "contract_code": CONTRACT_CODE,
            "signatures": {"pricing": "subtotal_cents(items, catalog)",
                           "discount": "discount_cents(subtotal, tier_rate_pct)",
                           "tax": "tax_cents(taxable, region_bp)",
                           "receipt": "compute_receipt(order)"}}


def _ref_pricing(scn, up):  return {"code": PRICING_CODE}
def _ref_discount(scn, up): return {"code": DISCOUNT_CODE}
def _ref_tax(scn, up):      return {"code": TAX_CODE}


def _ref_integrator(scn, up):
    # the integrator faithfully composes the modules in the architect's declared order
    order = up["architect"]["op_order"]
    return {"code": RECEIPT_DISCOUNT_FIRST if order == "discount_first" else RECEIPT_TAX_FIRST}


def _ref_tests(scn, up):
    return {"tests": ("assert compute_receipt({'items': [{'sku': 'A', 'qty': 2}], "
                      "'tier': 'gold', 'region': 'CA'})['total_cents'] == 1967\n")}


def _ref_reviewer(scn, up):
    return {"approved": True, "notes": "modules match the contract signatures"}


def _ref_ci(scn, up):
    return {"verdict": "ran acceptance suite", "cases": 3}


_BILLING_REF = {"architect": _ref_architect, "pricing": _ref_pricing, "discount": _ref_discount,
                "tax": _ref_tax, "integrator": _ref_integrator, "test_writer": _ref_tests,
                "reviewer": _ref_reviewer, "ci": _ref_ci}

# --- live agent prompts: (signature, summary) consumed by graph._llm_module when `think` is wired ---
_PRICING_LIVE = ("subtotal_cents(items, catalog)",
                 "catalog maps each item's 'sku' to an integer unit price in cents. Return the sum of "
                 "catalog[item['sku']] * item['qty'] over items.")
_DISCOUNT_LIVE = ("discount_cents(subtotal, tier_rate_pct)",
                  "Return round-half-up of subtotal * tier_rate_pct / 100 as an int (use math.floor(x + 0.5)).")
_TAX_LIVE_CORRECT = ("tax_cents(taxable, region_bp)",
                     "region_bp is a tax rate in basis points. Return round-half-up of "
                     "taxable * region_bp / 10000 as an int (use math.floor(x + 0.5)).")
# Tie-NEUTRAL tax prompt: units + formula are crisp, only the rounding CONVENTION is left unstated (as a
# real ticket would). Haiku reliably reaches for round() (banker's), which rounds a half-cent to even —
# a cent low — so the receipt total fails the hidden round-half-up suite. The model's OWN bug, no injection.
_TAX_LIVE_NEUTRAL = ("tax_cents(taxable, region_bp)",
                     "taxable is an integer amount in cents. region_bp is a tax rate in basis points "
                     "(925 means 9.25%). Return the tax as an integer number of cents, computed as "
                     "taxable * region_bp / 10000 and rounded to the nearest cent.")

# HEADLINE: a NATURAL middle-agent failure — the live tax module banker's-rounds (no fault injected).
_NATURAL = TeamScenario(
    name="billing_tax_rounding_natural",
    reference=_BILLING_REF,
    acceptance_tests=ACCEPTANCE,
    decision_fields={"architect": ["op_order", "money_unit", "rounding"]},
    natural=True,
    live={"tax": _TAX_LIVE_NEUTRAL},
)

# Deterministic spine: an injected architect op-order fault (the reliable scripted fallback demo).
_OP_ORDER = TeamScenario(
    name="billing_op_order",
    reference=_BILLING_REF,
    acceptance_tests=ACCEPTANCE,
    decision_fields={"architect": ["op_order", "money_unit", "rounding"]},
    fault=TeamFault("architect", "op_order", "tax_first"),
    live={"pricing": _PRICING_LIVE, "discount": _DISCOUNT_LIVE, "tax": _TAX_LIVE_CORRECT},
)

SCENARIOS: list[TeamScenario] = [_NATURAL, _OP_ORDER]   # natural first = the subject's headline

# DEFAULT stays the INJECTED scenario: it fails deterministically (no API key needed), so the CLI
# smoke + offline tests work. The natural scenario only fails live (real Claude must write round()).
DEFAULT = _OP_ORDER
