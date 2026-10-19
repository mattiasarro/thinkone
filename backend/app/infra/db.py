"""Async engine + tenant-scoped sessions.

Tenancy is enforced by Postgres RLS: every request session runs
``SET LOCAL app.account_id = '<uuid>'`` inside its transaction, and every tenant table
carries a policy comparing ``account_id`` to that setting (architecture §8).
"""

from __future__ import annotations

import uuid
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncEngine, AsyncSession, async_sessionmaker, create_async_engine

from app.infra.settings import get_settings

_engine: AsyncEngine | None = None
_sessionmaker: async_sessionmaker[AsyncSession] | None = None


def engine() -> AsyncEngine:
    global _engine, _sessionmaker
    if _engine is None:
        s = get_settings()
        _engine = create_async_engine(s.database_url, pool_pre_ping=True, pool_size=5, max_overflow=10)
        if s.db_app_role:
            install_app_role(_engine, s.db_app_role)
        _sessionmaker = async_sessionmaker(_engine, expire_on_commit=False)
    return _engine


def install_app_role(eng: AsyncEngine, role: str) -> None:
    """Every pooled connection runs as the NOBYPASSRLS app role. The SET ROLE goes straight to asyncpg, outside the
    adapter's implicit transaction: run through the adapted cursor it was part of that transaction, and a first request
    that rolled back (any 404) undid it — the connection stayed the superuser and RLS no longer applied on it."""
    from sqlalchemy import event

    @event.listens_for(eng.sync_engine, "connect")
    def _set_role(dbapi_conn, record):  # noqa: ANN001
        dbapi_conn.run_async(lambda conn: conn.execute(f'SET ROLE "{role}"'))


def sessionmaker() -> async_sessionmaker[AsyncSession]:
    engine()
    assert _sessionmaker is not None
    return _sessionmaker


async def dispose() -> None:
    global _engine, _sessionmaker
    if _engine is not None:
        await _engine.dispose()
        _engine = None
        _sessionmaker = None


async def set_tenant(session: AsyncSession, account_id: uuid.UUID | None) -> None:
    """Scope the current transaction to one account (RLS). ``None`` = no tenant (auth only)."""
    value = str(account_id) if account_id else ""
    await session.execute(text("SELECT set_config('app.account_id', :v, true)"), {"v": value})


@asynccontextmanager
async def tenant_session(account_id: uuid.UUID | None) -> AsyncIterator[AsyncSession]:
    """One transaction, scoped to a tenant. Commits on success, rolls back on error."""
    async with sessionmaker()() as session:
        async with session.begin():
            await set_tenant(session, account_id)
            yield session
