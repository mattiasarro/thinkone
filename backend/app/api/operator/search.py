from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import current_principal, db
from app.domain import search as search_domain

router = APIRouter(prefix="/search", tags=["search"], dependencies=[Depends(current_principal)])


class SearchHitOut(BaseModel):
    entity_type: str
    entity_id: uuid.UUID
    title: str
    subtitle: str | None
    link: str


@router.get("", response_model=list[SearchHitOut])
async def search(q: str = Query(default="", max_length=200), limit: int = Query(default=20, ge=1, le=100),
                 session: AsyncSession = Depends(db)) -> list[SearchHitOut]:
    rows = await search_domain.search(session, q, limit=limit)
    return [SearchHitOut(entity_type=r.entity_type, entity_id=r.entity_id, title=r.title, subtitle=r.subtitle, link=r.link) for r in rows]
