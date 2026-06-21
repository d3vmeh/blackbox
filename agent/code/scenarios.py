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

# The spec agent's task-specific question. Its answer is the scenario's KEY DECISION
# (stored under the spec's "unit" field) that the implementer branches on. Constrained
# to a small set of tokens so the deterministic reference can switch on it.
_PARSE_Q = ("In what TIME UNIT must the function's integer result be expressed — "
            "seconds, minutes, or hours? Answer with exactly one of those words.")


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
    spec_question: str = _PARSE_Q        # the constrained question the live spec agent answers


def _ref_spec(scn: "CodeScenario", up: dict) -> dict:
    return {"signature": "def parse_duration(s: str) -> int",
            "unit": "seconds",
            "summary": ("parse a duration string like '1h2m3s', '90s', or '2m' (h/m/s = "
                        "hours/minutes/seconds) and return the total elapsed time as an int")}


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

# --- task: celsius_to_fahrenheit (return int Fahrenheit) ---
_TEMP_Q = ("In what UNIT must the result be expressed — fahrenheit or celsius? "
           "Answer with exactly one of those words.")
_TEMP_CORRECT = "def celsius_to_fahrenheit(c):\n    return int(c * 9 / 5 + 32)\n"
_TEMP_CELSIUS = "def celsius_to_fahrenheit(c):\n    return int(c)\n"        # spec said celsius
_TEMP_BAD_CODE = "def celsius_to_fahrenheit(c):\n    return int(c * 9 / 5)\n"  # forgets + 32
_TEMP_ACCEPTANCE = ("assert celsius_to_fahrenheit(100) == 212\n"
                    "assert celsius_to_fahrenheit(0) == 32\n"
                    "assert celsius_to_fahrenheit(37) == 98\n")


def _ref_spec_temp(scn, up):
    return {"signature": "def celsius_to_fahrenheit(c: int) -> int",
            "unit": "fahrenheit",
            "summary": "take the input temperature in Celsius and return it, floored to an int"}


def _ref_impl_temp(scn, up):
    unit = up["spec_interpreter"]["unit"]
    return {"code": _TEMP_CORRECT if unit == "fahrenheit" else _TEMP_CELSIUS}


def _ref_tests_temp(scn, up):
    unit = up["spec_interpreter"]["unit"]
    expected = 212 if unit == "fahrenheit" else 100
    return {"tests": f"assert celsius_to_fahrenheit(100) == {expected}\n"}


_TEMP_REF = {"spec_interpreter": _ref_spec_temp, "implementer": _ref_impl_temp,
             "test_writer": _ref_tests_temp, "reviewer": _ref_review}

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

SCENARIOS += [
    CodeScenario(
        name="celsius_spec",
        requirement="Implement celsius_to_fahrenheit(c). Return the temperature in "
                    "FAHRENHEIT as an int (floored).",
        reference=_TEMP_REF, acceptance_tests=_TEMP_ACCEPTANCE,
        function_name="celsius_to_fahrenheit", spec_question=_TEMP_Q,
        fault=CodeFault("spec_interpreter", "unit", "celsius"),
    ),
    CodeScenario(
        name="celsius_impl",
        requirement="Implement celsius_to_fahrenheit(c). Return the temperature in "
                    "FAHRENHEIT as an int (floored).",
        reference=_TEMP_REF, acceptance_tests=_TEMP_ACCEPTANCE,
        function_name="celsius_to_fahrenheit", spec_question=_TEMP_Q,
        fault=CodeFault("implementer", "code", _TEMP_BAD_CODE),
    ),
]

# --- task: kib (bytes -> kibibytes, floor) ---
_KIB_Q = ("In what UNIT must the result be expressed — kibibytes or mebibytes? "
          "Answer with exactly one of those words.")
_KIB_CORRECT = "def kib(n_bytes):\n    return n_bytes // 1024\n"
_KIB_MEBI = "def kib(n_bytes):\n    return n_bytes // 1024 // 1024\n"   # spec said mebibytes
_KIB_BAD_CODE = "def kib(n_bytes):\n    return n_bytes // 1000\n"        # KB not KiB
_KIB_ACCEPTANCE = ("assert kib(1024) == 1\n"
                   "assert kib(1048576) == 1024\n"
                   "assert kib(1000000) == 976\n")


def _ref_spec_kib(scn, up):
    return {"signature": "def kib(n_bytes: int) -> int",
            "unit": "kibibytes",
            "summary": "convert the byte count to the target unit by integer floor division"}


def _ref_impl_kib(scn, up):
    unit = up["spec_interpreter"]["unit"]
    return {"code": _KIB_CORRECT if unit == "kibibytes" else _KIB_MEBI}


def _ref_tests_kib(scn, up):
    unit = up["spec_interpreter"]["unit"]
    expected = 1 if unit == "kibibytes" else 0
    return {"tests": f"assert kib(1024) == {expected}\n"}


_KIB_REF = {"spec_interpreter": _ref_spec_kib, "implementer": _ref_impl_kib,
            "test_writer": _ref_tests_kib, "reviewer": _ref_review}

SCENARIOS += [
    CodeScenario(
        name="kib_spec",
        requirement="Implement kib(n_bytes). Return the size in KIBIBYTES (KiB) as an int, "
                    "floor-dividing the byte count by 1024.",
        reference=_KIB_REF, acceptance_tests=_KIB_ACCEPTANCE, function_name="kib",
        spec_question=_KIB_Q, fault=CodeFault("spec_interpreter", "unit", "mebibytes"),
    ),
    CodeScenario(
        name="kib_impl",
        requirement="Implement kib(n_bytes). Return the size in KIBIBYTES (KiB) as an int, "
                    "floor-dividing the byte count by 1024.",
        reference=_KIB_REF, acceptance_tests=_KIB_ACCEPTANCE, function_name="kib",
        spec_question=_KIB_Q, fault=CodeFault("implementer", "code", _KIB_BAD_CODE),
    ),
]

# --- task: merge_intervals (merge overlapping [start, end] intervals) — algorithmic, edge cases ---
_MI_Q = ("Must intervals that only TOUCH at an endpoint (e.g. [1,4] and [4,5]) be merged? "
         "Answer 'merge_touching' if touching intervals merge, or 'strict_overlap' if only "
         "intervals that strictly overlap merge. Answer with exactly one of those two words.")
_MI_REQUIREMENT = (
    "Implement merge_intervals(intervals): given a list of [start, end] integer intervals, merge "
    "all overlapping intervals and return them as a list of [start, end] lists sorted by start. "
    "Intervals that only TOUCH at an endpoint (e.g. [1,4] and [4,5]) count as overlapping and must "
    "be merged into one."
)
_MI_CORRECT = (
    "def merge_intervals(intervals):\n"
    "    out = []\n"
    "    for start, end in sorted(intervals):\n"
    "        if out and start <= out[-1][1]:\n"
    "            out[-1][1] = max(out[-1][1], end)\n"
    "        else:\n"
    "            out.append([start, end])\n"
    "    return out\n"
)
# spec said only STRICTLY-overlapping intervals merge -> touching endpoints stay split
_MI_STRICT = _MI_CORRECT.replace("start <= out[-1][1]", "start < out[-1][1]")
# implementer bug: assigns end instead of max(prev_end, end) -> a contained interval truncates it
_MI_BAD_CODE = _MI_CORRECT.replace("out[-1][1] = max(out[-1][1], end)", "out[-1][1] = end")
_MI_ACCEPTANCE = (
    "assert merge_intervals([[1,3],[2,6],[8,10],[15,18]]) == [[1,6],[8,10],[15,18]]\n"
    "assert merge_intervals([[1,4],[4,5]]) == [[1,5]]\n"
    "assert merge_intervals([[1,5],[2,3]]) == [[1,5]]\n"
    "assert merge_intervals([[6,8],[1,9],[2,4],[4,7]]) == [[1,9]]\n"
)


def _ref_spec_mi(scn, up):
    return {"signature": "def merge_intervals(intervals: list[list[int]]) -> list[list[int]]",
            "unit": "merge_touching",
            "summary": ("sort the [start, end] intervals by start and merge overlapping ones into a "
                        "minimal sorted list of [start, end] lists")}


def _ref_impl_mi(scn, up):
    rule = up["spec_interpreter"]["unit"]
    return {"code": _MI_CORRECT if rule == "merge_touching" else _MI_STRICT}


def _ref_tests_mi(scn, up):
    rule = up["spec_interpreter"]["unit"]
    expected = "[[1, 5]]" if rule == "merge_touching" else "[[1, 4], [4, 5]]"
    return {"tests": f"assert merge_intervals([[1,4],[4,5]]) == {expected}\n"}


_MI_REF = {"spec_interpreter": _ref_spec_mi, "implementer": _ref_impl_mi,
           "test_writer": _ref_tests_mi, "reviewer": _ref_review}

SCENARIOS += [
    CodeScenario(
        name="merge_intervals_spec",
        requirement=_MI_REQUIREMENT, reference=_MI_REF, acceptance_tests=_MI_ACCEPTANCE,
        function_name="merge_intervals", spec_question=_MI_Q,
        fault=CodeFault("spec_interpreter", "unit", "strict_overlap"),
    ),
    CodeScenario(
        name="merge_intervals_impl",
        requirement=_MI_REQUIREMENT, reference=_MI_REF, acceptance_tests=_MI_ACCEPTANCE,
        function_name="merge_intervals", spec_question=_MI_Q,
        fault=CodeFault("implementer", "code", _MI_BAD_CODE),
    ),
]

DEFAULT = SCENARIOS[0]
