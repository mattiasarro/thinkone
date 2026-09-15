"""Integration tests run against a real Postgres (RLS cannot be tested on SQLite).

DATABASE_URL_TEST (default: local docker on 55433, database ``thinkone_test``) is created
if missing, migrated with Alembic to head, and truncated between tests.
"""

from __future__ import annotations

import asyncio
import os
import uuid
from collections.abc import AsyncIterator

import pytest
from httpx import ASGITransport, AsyncClient

os.environ.setdefault("APP_ENV", "test")
os.environ.setdefault("DATABASE_URL", "postgresql+asyncpg://thinkone:thinkone@localhost:55433/thinkone_test")
os.environ.setdefault("LLM_MODE", "fake")
os.environ.setdefault("INTEGRATIONS_MODE", "fake")
os.environ.setdefault("EMAIL_PROVIDER", "fake")
os.environ.setdefault("S3_ENDPOINT", "")

from app.infra.settings import get_settings  # noqa: E402

get_settings.cache_clear()


def _ensure_database() -> None:
    import psycopg

    s = get_settings()
    url = s.sync_database_url()
    dbname = url.rsplit("/", 1)[1]
    admin = url.rsplit("/", 1)[0] + "/postgres"
    with psycopg.connect(admin, autocommit=True) as conn:
        exists = conn.execute("SELECT 1 FROM pg_database WHERE datname = %s", (dbname,)).fetchone()
        if not exists:
            conn.execute(f'CREATE DATABASE "{dbname}"')


def _migrate() -> None:
    import subprocess
    import sys

    subprocess.run([sys.executable, "-m", "alembic", "upgrade", "head"], check=True, cwd=os.path.dirname(os.path.dirname(__file__)))
    from procrastinate import SyncPsycopgConnector

    from app.infra.settings import get_settings as gs

    import procrastinate

    app = procrastinate.App(connector=SyncPsycopgConnector(conninfo=gs().sync_database_url()))
    with app.open():
        try:
            app.schema_manager.apply_schema()
        except Exception:
            pass  # already applied


@pytest.fixture(scope="session", autouse=True)
def _database():
    _ensure_database()
    _migrate()
    yield


@pytest.fixture(scope="session")
def event_loop():
    loop = asyncio.new_event_loop()
    yield loop
    loop.close()


@pytest.fixture(autouse=True)
async def _clean_db():
    from sqlalchemy import text

    from app.infra.db import dispose, sessionmaker
    from app.domain.seed import seed_globals
    from app.models.base import TENANT_TABLES

    yield
    async with sessionmaker()() as s:
        async with s.begin():
            await s.execute(text("RESET ROLE"))
            tables = ", ".join(f'"{t}"' for t in TENANT_TABLES + ["auth_session", "account", "user", "key_date_kind", "asset_type", "contract_type"])
            await s.execute(text(f"TRUNCATE {tables} CASCADE"))
            await s.execute(text("TRUNCATE procrastinate_jobs CASCADE"))
            await seed_globals(s)
    await dispose()


@pytest.fixture
async def client() -> AsyncIterator[AsyncClient]:
    from app.api.main import app
    from app.domain.seed import seed_globals
    from app.infra.blobstore import MemoryBlobStore, set_blobstore
    from app.infra.db import sessionmaker
    from app.integrations.email import FakeEmailProvider, set_email_provider

    set_blobstore(MemoryBlobStore())
    set_email_provider(FakeEmailProvider())
    async with sessionmaker()() as s:
        async with s.begin():
            await seed_globals(s)
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
        yield c


@pytest.fixture
async def admin(client: AsyncClient) -> dict:
    r = await client.post("/api/v1/auth/register", json={"account_name": "Taevavärava OÜ", "email": "tarmo@example.com", "name": "Tarmo Sepp", "password": "salasona123"})
    assert r.status_code == 201, r.text
    return r.json()


def new_email() -> str:
    return f"u{uuid.uuid4().hex[:8]}@example.com"
