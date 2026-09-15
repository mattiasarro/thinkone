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
            from sqlalchemy import event

            role = s.db_app_role

            @event.listens_for(_engine.sync_engine, "connect")
            def _set_role(dbapi_conn, record):  # noqa: ANN001
                # asyncpg adapter: run synchronously via the adapted cursor
                cur = dbapi_conn.cursor()
                cur.execute(f'SET ROLE "{role}"')
                cur.close()

        _sessionmaker = async_sessionmaker(_engine, expire_on_commit=False)
    return _engine


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
