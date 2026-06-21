"""P1 — Coding-pipeline oracle. Runs the final implementation against a scenario's
hidden acceptance asserts in a subprocess (timeout, no network/fs use by the task).
Returns True iff every assert passes. Additive — beside oracle.py / ap_oracle.py."""
from __future__ import annotations

import subprocess
import sys
import tempfile
from pathlib import Path


def evaluate_code(final_code: str, scenario, timeout: float = 10.0) -> bool:
    """True iff `final_code` satisfies scenario.acceptance_tests."""
    with tempfile.TemporaryDirectory() as d:
        (Path(d) / "solution.py").write_text(final_code)
        runner = "from solution import parse_duration\n" + scenario.acceptance_tests
        (Path(d) / "check.py").write_text(runner)
        try:
            proc = subprocess.run(
                [sys.executable, "check.py"],
                cwd=d, capture_output=True, timeout=timeout,
            )
        except subprocess.TimeoutExpired:
            return False
        return proc.returncode == 0
