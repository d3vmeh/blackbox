"""P1 — Team-pipeline scenarios. One billing task; per-agent REFERENCE outputs
(deterministic functions of upstream — the no-key fallback AND the answer key), a hidden
acceptance suite (the oracle), and a fault injected at one agent/field. Mirrors
agent/code/scenarios.py, extended to a fan-out DAG (3 parallel module implementers)."""
from __future__ import annotations

from dataclasses import dataclass
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

SCENARIOS: list[TeamScenario] = [
    TeamScenario(
        name="billing_op_order",
        reference=_BILLING_REF,
        acceptance_tests=ACCEPTANCE,
        decision_fields={"architect": ["op_order", "money_unit", "rounding"]},
        fault=TeamFault("architect", "op_order", "tax_first"),
    ),
]

DEFAULT = SCENARIOS[0]
