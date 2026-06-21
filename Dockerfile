# Single-service deploy (Railway): build the Vite SPA, then have FastAPI serve both
# the API and the built static frontend from one container.

# --- stage 1: build the frontend ---------------------------------------------
# The SPA imports demo fixtures from ../../../../shared/fixtures, so the build needs
# both web/ and shared/ present as siblings under /repo.
FROM node:20-slim AS web
WORKDIR /repo/web
COPY web/package.json web/package-lock.json ./
RUN npm ci
COPY web/ ./
COPY shared/ /repo/shared/
RUN npm run build        # -> /repo/web/dist

# --- stage 2: python backend + serve -----------------------------------------
FROM python:3.12-slim AS app
WORKDIR /app

# install backend deps from pyproject (heavy ML deps are fine on Railway containers)
COPY pyproject.toml ./
COPY . .
RUN pip install --no-cache-dir .

# drop the built SPA where api/main.py mounts it (web/dist)
COPY --from=web /repo/web/dist ./web/dist

EXPOSE 8000
# `python -m` puts /app on sys.path so api.main / agent.* resolve; $PORT is set by Railway
CMD python -m uvicorn api.main:app --host 0.0.0.0 --port ${PORT:-8000}
