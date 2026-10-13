"""Share-link principal: token → live link → tenant-scoped session + a link-holder Actor."""

from __future__ import annotations

from collections.abc import AsyncIterator
from dataclasses import dataclass

from fastapi import Depends, HTTPException, Path
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.domain import share_links
from app.domain.events import Actor
from app.infra.db import sessionmaker, set_tenant
from app.models.quotes import ShareLink


@dataclass
class LinkPrincipal:
    link: ShareLink
    actor: Actor


async def portal_session(token: str = Path(..., min_length=10, max_length=400)) -> AsyncIterator[tuple[AsyncSession, LinkPrincipal]]:
    """One transaction scoped to the link's account. Resolves the link under the RLS bypass, then narrows the tenant."""
    lid = share_links.link_id_from_token(token)
    if not lid:
        raise HTTPException(404, "Link ei kehti")
    async with sessionmaker()() as session:
        async with session.begin():
            await session.execute(text("SELECT set_config('app.bypass_rls', 'on', true)"))
            link = await session.get(ShareLink, lid)
            if not link:
                raise HTTPException(404, "Link ei kehti")
            await session.execute(text("SELECT set_config('app.bypass_rls', 'off', true)"))
            await set_tenant(session, link.account_id)
            try:
                link = await share_links.get_live_link(session, token)
            except Exception as e:  # noqa: BLE001
                raise HTTPException(404, "Link ei kehti või on aegunud") from e
            actor = Actor.link_holder(link.account_id, link.email)
            await share_links.touch(session, actor, link)
            yield session, LinkPrincipal(link=link, actor=actor)


PortalDep = Depends(portal_session)
