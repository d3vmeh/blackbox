"""P1 — Scenarios for the Accounts-Payable subject. Generalizes the demo from one
hardcoded invoice to many, with a fault that can be injected at ANY agent/field — so we
can prove the monitor localizes whichever agent introduced the error, not a fixed one.

`expect` is the CORRECT outcome: most invoices should be paid, but an over-limit or
suspicious one should be BLOCKED (escalated). A fault can make the system pay one it
should have blocked, or block/mispay one it should have paid.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Optional

VENDOR_ALLOWLIST = {"Acme Corp", "Globex", "Initech", "Umbrella", "Soylent"}  # note: "Hooli" is NOT trusted


@dataclass
class Fault:
    agent: str          # which agent introduces the error (extractor/matcher/fraud/approver/payment)
    field: str          # which output field becomes wrong
    bad_value: Any      # the wrong value it emits


@dataclass
class Scenario:
    name: str
    vendor: str
    amount: float
    due_date: str
    po: str
    fault: Optional[Fault] = None
    approval_limit: float = 50000.0
    expect: str = "paid"          # correct outcome: "paid" | "blocked"

    def invoice_text(self) -> str:
        return (f"INVOICE — {self.vendor}\n"
                f"PO: {self.po}\n"
                f"Amount due: ${self.amount:,.2f}\n"
                f"Due date: {self.due_date}\n")

    def po_book(self) -> dict:
        return {self.po: {"vendor": self.vendor, "amount": self.amount}}


# A labeled suite: faults at EVERY agent + two clean controls (one paid, one correctly blocked).
SCENARIOS: list[Scenario] = [
    # --- faults at the EXTRACTOR (different fields) ---
    Scenario("acme_amount",     "Acme Corp", 4200.00,  "2026-07-15", "PO-7781",
             fault=Fault("extractor", "amount", 42000.00)),       # decimal slip
    Scenario("globex_vendor",   "Globex",    1250.00,  "2026-07-20", "PO-3310",
             fault=Fault("extractor", "vendor", "Globox")),       # misread vendor name
    Scenario("initech_date",    "Initech",   9900.00,  "2026-08-01", "PO-5567",
             fault=Fault("extractor", "due_date", "2026-09-01")), # wrong due date
    Scenario("soylent_amount",  "Soylent",  12300.00,  "2026-07-22", "PO-4040",
             fault=Fault("extractor", "amount", 1230.00)),        # dropped a digit

    # --- faults DOWNSTREAM (different agents) ---
    Scenario("matcher_amount",  "Umbrella",  3300.00,  "2026-07-18", "PO-9001",
             fault=Fault("matcher", "amount", 8800.00)),          # corrupts on pass-through
    Scenario("payment_shortpay","Globex",    5400.00,  "2026-07-25", "PO-2218",
             fault=Fault("payment", "amount_paid", 1.00)),        # underpays at the last step
    Scenario("approver_overlimit","Initech", 75000.00, "2026-07-30", "PO-8800", expect="blocked",
             fault=Fault("approver", "approved", True)),          # rubber-stamps an over-limit invoice
    Scenario("fraud_falseneg",  "Hooli",     2000.00,  "2026-07-19", "PO-6543", expect="blocked",
             fault=Fault("fraud", "risk", "low")),                # clears an untrusted vendor

    # --- clean controls (no fault) ---
    Scenario("clean_paid",      "Acme Corp",  760.00,  "2026-07-12", "PO-1200"),               # should PAY
    Scenario("clean_blocked",   "Umbrella", 64000.00,  "2026-08-05", "PO-7000", expect="blocked"),  # over limit → should BLOCK
]

DEFAULT = SCENARIOS[0]
