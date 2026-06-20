"""P4 — FastAPI app serving the frontend over SSE.

Endpoints (stream the demo beats):
  GET /trace/{id}        -> Trace (the wall of logs)
  GET /attribute/{id}    -> Attribution (root + blast_radius) [SSE: stream candidates]
  POST /replay           -> ReplayResult (fork/inject/confirm) [SSE: per-run outcomes]

Every endpoint must serve the fixture (shared/fixtures/flight_fail.json) as a
fallback so the demo works even if the live agent is flaky. Stubs are swapped for
live modules one seam at a time.
"""

from __future__ import annotations

from fastapi import FastAPI

app = FastAPI(title="Blackbox API")


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}
