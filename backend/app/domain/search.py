"""search_index projection — maintained in-transaction by the commands that mutate entities."""

from __future__ import annotations

import uuid

from sqlalchemy import func, select
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.core import SearchIndex


async def index_entity(
    session: AsyncSession,
    account_id: uuid.UUID,
    entity_type: str,
    entity_id: uuid.UUID,
    title: str,
    text: str,
    link: str,
    subtitle: str | None = None,
) -> None:
    text = (text or "")[:20000]
    stmt = insert(SearchIndex).values(
        account_id=account_id,
        entity_type=entity_type,
        entity_id=entity_id,
        title=title[:400],
        subtitle=(subtitle or "")[:400] or None,
        text=text,
        tsv=func.to_tsvector("simple", f"{title} {subtitle or ''} {text}"),
        link=link,
    )
    stmt = stmt.on_conflict_do_update(
        constraint="uq_search_entity",
        set_={"title": stmt.excluded.title, "subtitle": stmt.excluded.subtitle, "text": stmt.excluded.text,
              "tsv": stmt.excluded.tsv, "link": stmt.excluded.link, "updated_at": func.now()},
    )
    await session.execute(stmt)


async def remove_entity(session: AsyncSession, entity_type: str, entity_id: uuid.UUID) -> None:
    row = (await session.execute(select(SearchIndex).where(SearchIndex.entity_type == entity_type, SearchIndex.entity_id == entity_id))).scalar_one_or_none()
    if row:
        await session.delete(row)


async def search(session: AsyncSession, q: str, limit: int = 20) -> list[SearchIndex]:
    q = q.strip()
    if not q:
        return []
    ts = func.plainto_tsquery("simple", q)
    pattern = f"%{q}%"
    stmt = (
        select(SearchIndex)
        .where((SearchIndex.tsv.op("@@")(ts)) | SearchIndex.title.ilike(pattern) | SearchIndex.text.ilike(pattern))
        .order_by(func.ts_rank(SearchIndex.tsv, ts).desc(), SearchIndex.updated_at.desc())
        .limit(limit)
    )
    return list((await session.execute(stmt)).scalars())
