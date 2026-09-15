"""Procrastinate app — Postgres-backed queue; jobs enqueue inside the domain transaction."""

from __future__ import annotations

import procrastinate

from app.infra.settings import get_settings

_app: procrastinate.App | None = None


def worker_app() -> procrastinate.App:
    global _app
    if _app is None:
        s = get_settings()
        connector = procrastinate.PsycopgConnector(conninfo=s.sync_database_url())
        _app = procrastinate.App(connector=connector, import_paths=["app.worker.tasks"])
    return _app


def set_worker_app(app: procrastinate.App | None) -> None:
    global _app
    _app = app
