from agent.team.oracle import evaluate_package
from agent.team.source import ACCEPTANCE, CORRECT_MODULES, RECEIPT_TAX_FIRST


def test_correct_package_passes():
    assert evaluate_package(CORRECT_MODULES, ACCEPTANCE) is True


def test_tax_first_package_fails():
    bad = dict(CORRECT_MODULES, **{"receipt.py": RECEIPT_TAX_FIRST})
    assert evaluate_package(bad, ACCEPTANCE) is False
