# ThinkOne backend — one image, two entrypoints (api | worker). Railway builds this per service.
FROM python:3.12-slim-bookworm AS base
ENV PYTHONUNBUFFERED=1 PYTHONDONTWRITEBYTECODE=1 UV_COMPILE_BYTECODE=1 UV_LINK_MODE=copy
RUN apt-get update && apt-get install -y --no-install-recommends libpq5 curl && rm -rf /var/lib/apt/lists/*
COPY --from=ghcr.io/astral-sh/uv:0.5 /uv /uvx /bin/
WORKDIR /srv
COPY pyproject.toml uv.lock ./
RUN uv sync --frozen --no-dev --no-install-project
COPY . .
RUN uv sync --frozen --no-dev
ENV PATH="/srv/.venv/bin:$PATH" PORT=8000
EXPOSE 8000
# api (default). Worker overrides the command: ["procrastinate", "--app", "app.worker.tasks.app", "worker"]
CMD ["sh", "-c", "python scripts/migrate.py && uvicorn app.api.main:app --host :: --port ${PORT}"]
