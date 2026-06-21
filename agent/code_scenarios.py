"""P1 — Coding-pipeline scenarios. One self-contained task per scenario, with
per-agent REFERENCE outputs (deterministic functions of upstream — the mock fallback
AND the answer key), a hidden acceptance-test suite (the oracle), and an optional
fault injected at any agent/field. Mirrors agent/ap_scenarios.py for the AP demo."""
from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Callable, Optional

AGENTS = ["spec_interpreter", "implementer", "test_writer", "reviewer"]

# --- the reference implementation source the correct pipeline produces ---
_CORRECT_CODE = (
    "import re\n"
    "def parse_duration(s):\n"
    "    total = 0\n"
    "    for value, unit in re.findall(r'(\\d+)([hms])', s):\n"
    "        total += int(value) * {'h': 3600, 'm': 60, 's': 1}[unit]\n"
    "    return total\n"
)
# what a faithful implementer writes if the SPEC says the unit is minutes
_MINUTES_CODE = _CORRECT_CODE.replace("    return total\n", "    return total // 60\n")

# implementer-fault: a plausible bug — counts hours/minutes but drops seconds
_PARSE_BAD_CODE = (
    "import re\n"
    "def parse_duration(s):\n"
    "    total = 0\n"
    "    for value, unit in re.findall(r'(\\d+)([hms])', s):\n"
    "        total += int(value) * {'h': 3600, 'm': 60, 's': 0}[unit]\n"
    "    return total\n"
)

_ACCEPTANCE = (
    "assert parse_duration('2m30s') == 150\n"
    "assert parse_duration('1h') == 3600\n"
    "assert parse_duration('45s') == 45\n"
)


@dataclass
class CodeFault:
    agent: str
    field: str
    bad_value: Any


@dataclass
class CodeScenario:
    name: str
    requirement: str
    reference: dict                      # agent -> fn(scn, up) -> dict (correct output)
    acceptance_tests: str                # python asserts over the function (hidden oracle)
    function_name: str = "parse_duration"  # the entry point the acceptance tests import
    fault: Optional[CodeFault] = None


def _ref_spec(scn: "CodeScenario", up: dict) -> dict:
    return {"signature": "def parse_duration(s: str) -> int",
            "unit": "seconds",
            "summary": "sum h/m/s components into a total number of seconds"}


def _ref_impl(scn: "CodeScenario", up: dict) -> dict:
    # a faithful implementer writes code that matches the SPEC's unit
    unit = up["spec_interpreter"]["unit"]
    return {"code": _CORRECT_CODE if unit == "seconds" else _MINUTES_CODE}


def _ref_tests(scn: "CodeScenario", up: dict) -> dict:
    # visible tests derived from the (possibly wrong) spec — self-consistent, so they pass
    unit = up["spec_interpreter"]["unit"]
    expected = 150 if unit == "seconds" else 2
    return {"tests": f"assert parse_duration('2m30s') == {expected}\n"}


def _ref_review(scn: "CodeScenario", up: dict) -> dict:
    # approves when code is internally consistent with the spec (it always is here)
    return {"approved": True, "notes": "code matches the structured spec"}


_PARSE_REF = {"spec_interpreter": _ref_spec, "implementer": _ref_impl,
              "test_writer": _ref_tests, "reviewer": _ref_review}

SCENARIOS: list[CodeScenario] = [
    CodeScenario(
        name="parse_duration_units",
        requirement=("Implement parse_duration(s). Input like '1h2m3s', '90s', '2m'. "
                     "Return the TOTAL NUMBER OF SECONDS as an int."),
        reference=_PARSE_REF, acceptance_tests=_ACCEPTANCE, function_name="parse_duration",
        fault=CodeFault("spec_interpreter", "unit", "minutes"),
    ),
    CodeScenario(
        name="parse_duration_impl",
        requirement=("Implement parse_duration(s). Input like '1h2m3s', '90s', '2m'. "
                     "Return the TOTAL NUMBER OF SECONDS as an int."),
        reference=_PARSE_REF, acceptance_tests=_ACCEPTANCE, function_name="parse_duration",
        fault=CodeFault("implementer", "code", _PARSE_BAD_CODE),
    ),
    CodeScenario(
        name="parse_duration_clean",
        requirement=("Implement parse_duration(s). Input like '1h2m3s', '90s', '2m'. "
                     "Return the TOTAL NUMBER OF SECONDS as an int."),
        reference=_PARSE_REF, acceptance_tests=_ACCEPTANCE, function_name="parse_duration",
        fault=None,
    ),
]

DEFAULT = SCENARIOS[0]
