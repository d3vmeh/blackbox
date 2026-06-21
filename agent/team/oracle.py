"""P1 — Team-pipeline oracle. Assembles the generated module files into a temp package
and runs the hidden acceptance asserts (importing compute_receipt from receipt.py) in a
subprocess. Returns True iff every assert passes. Mirrors eval/code_oracle.evaluate_code,
but for a multi-file package instead of one solution.py."""
from __future__ import annotations

import subprocess
import sys
import tempfile
from pathlib import Path


def evaluate_package(modules: dict[str, str], acceptance_tests: str,
                     timeout: float = 10.0) -> bool:
    """True iff the assembled `modules` (filename -> source) satisfy `acceptance_tests`."""
    with tempfile.TemporaryDirectory() as d:
        for fname, code in modules.items():
            (Path(d) / fname).write_text(code)
        (Path(d) / "check.py").write_text(
            "from receipt import compute_receipt\n" + acceptance_tests)
        try:
            proc = subprocess.run([sys.executable, "check.py"], cwd=d,
                                  capture_output=True, timeout=timeout)
        except subprocess.TimeoutExpired:
            return False
        return proc.returncode == 0
