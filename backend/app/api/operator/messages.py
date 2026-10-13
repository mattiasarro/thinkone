"""Suhtlus — every CommunicationThread as one timeline per quote/contract."""

from __future__ import annotations

import uuid
from datetime import datetime

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import db
from app.domain import messages as messages_domain
from app.models.contracts import Contract
from app.models.core import Party
from app.models.quotes import Quote

router = APIRouter(prefix="/messages", tags=["messages"])


class ThreadOut(BaseModel):
    subject_type: str
    subject_id: uuid.UUID
    number: str | None
    title: str
    party_name: str | None
    status: str | None
    link: str
    last_body: str
    last_author_type: str
    last_author_name: str | None
    last_at: datetime
    unread: int
    next_step: dict | None = None


@router.get("/threads", response_model=list[ThreadOut])
async def threads(unanswered: bool = Query(default=False), q: str | None = None, session: AsyncSession = Depends(db)) -> list[ThreadOut]:
    rows = await messages_domain.all_subjects(session)
    qids = [sid for st, sid, _, _ in rows if st == "quote"]
    cids = [sid for st, sid, _, _ in rows if st == "contract"]
    quotes = {x.id: (x, p) for x, p in (await session.execute(select(Quote, Party).join(Party, Party.id == Quote.party_id).where(Quote.id.in_(qids)))).all()} if qids else {}
    contracts = {c.id: c for c in (await session.execute(select(Contract).where(Contract.id.in_(cids)))).scalars()} if cids else {}
    out: list[ThreadOut] = []
    for st, sid, m, unread in rows:
        if st == "quote" and sid in quotes:
            x, p = quotes[sid]
            number, title, party, status, link = x.number, f"Pakkumine {x.number}", p.name, x.status, f"/app/portfell/pakkumine/{x.id}"
        elif st == "contract" and sid in contracts:
            c = contracts[sid]
            number, title, party, status, link = c.number, c.title, None, c.status, f"/app/portfell/leping/{c.id}"
        else:
            continue
        if unanswered and (unread == 0 and m.author_type != "client"):
            continue
        hay = " ".join(x for x in [number, title, party, m.body] if x).lower()
        if q and q.strip().lower() not in hay:
            continue
        out.append(ThreadOut(subject_type=st, subject_id=sid, number=number, title=title, party_name=party, status=status, link=link, last_body=m.body,
                             last_author_type=m.author_type, last_author_name=m.author_name, last_at=m.created_at, unread=unread))
    return out
