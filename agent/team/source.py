"""P1 — Billing module source: the deterministic reference code each team agent emits,
plus the hidden acceptance suite. Two receipt variants differ ONLY in op-order:
discount_first (correct) vs tax_first (the architect's contract bug — taxes the
pre-discount base). Money is integer cents; rounding is round-half-up."""
from __future__ import annotations

CONTRACT_CODE = (
    "CATALOG = {'A': 1000, 'B': 2500, 'C': 599}\n"
    "TIER_RATES = {'none': 0, 'silver': 5, 'gold': 10}\n"
    "REGION_RATES = {'CA': 925, 'NY': 888, 'OR': 0}\n"
)

PRICING_CODE = (
    "def subtotal_cents(items, catalog):\n"
    "    return sum(catalog[i['sku']] * i['qty'] for i in items)\n"
)

DISCOUNT_CODE = (
    "from math import floor\n"
    "def discount_cents(subtotal, tier_rate_pct):\n"
    "    return floor(subtotal * tier_rate_pct / 100 + 0.5)\n"
)

TAX_CODE = (
    "from math import floor\n"
    "def tax_cents(taxable, region_bp):\n"
    "    return floor(taxable * region_bp / 10000 + 0.5)\n"
)

_RECEIPT_HEAD = (
    "from pricing import subtotal_cents\n"
    "from discount import discount_cents\n"
    "from tax import tax_cents\n"
    "from contract import CATALOG, TIER_RATES, REGION_RATES\n"
    "def compute_receipt(order):\n"
    "    subtotal = subtotal_cents(order['items'], CATALOG)\n"
    "    discount = discount_cents(subtotal, TIER_RATES[order['tier']])\n"
)
_RECEIPT_TAIL = (
    "    return {'subtotal_cents': subtotal, 'discount_cents': discount,\n"
    "            'tax_cents': tax, 'total_cents': total,\n"
    "            'formatted': '$%.2f' % (total / 100)}\n"
)

# correct: tax the DISCOUNTED subtotal
RECEIPT_DISCOUNT_FIRST = _RECEIPT_HEAD + (
    "    taxable = subtotal - discount\n"
    "    tax = tax_cents(taxable, REGION_RATES[order['region']])\n"
    "    total = taxable + tax\n"
) + _RECEIPT_TAIL

# bug: tax the FULL subtotal, then subtract discount
RECEIPT_TAX_FIRST = _RECEIPT_HEAD + (
    "    tax = tax_cents(subtotal, REGION_RATES[order['region']])\n"
    "    total = subtotal - discount + tax\n"
) + _RECEIPT_TAIL

# hidden acceptance suite — cases 1 & 2 are op-order-sensitive (non-zero discount AND tax),
# case 3 is a baseline both orders satisfy. Totals are the discount_first answers.
ACCEPTANCE = (
    "assert compute_receipt({'items': [{'sku': 'A', 'qty': 2}], 'tier': 'gold', 'region': 'CA'})['total_cents'] == 1967\n"
    "assert compute_receipt({'items': [{'sku': 'B', 'qty': 1}, {'sku': 'C', 'qty': 3}], 'tier': 'silver', 'region': 'NY'})['total_cents'] == 4444\n"
    "assert compute_receipt({'items': [{'sku': 'A', 'qty': 1}], 'tier': 'none', 'region': 'OR'})['total_cents'] == 1000\n"
)

CORRECT_MODULES = {
    "contract.py": CONTRACT_CODE,
    "pricing.py": PRICING_CODE,
    "discount.py": DISCOUNT_CODE,
    "tax.py": TAX_CODE,
    "receipt.py": RECEIPT_DISCOUNT_FIRST,
}
