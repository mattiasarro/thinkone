"""Superadmin operations across tenants. Callers check the superadmin right; everything here runs with the RLS bypass."""

from __future__ import annotations

import uuid
from dataclasses import dataclass

import structlog
from sqlalchemy import delete, select, text, update
from sqlalchemy.exc import IntegrityError

from app.domain.errors import NotFound
from app.infra.blobstore import blobstore
from app.infra.db import sessionmaker
from app.models import Base
from app.models.core import Account, Attachment, AuthSession, Membership, PasswordReset, User

log = structlog.get_logger()


@dataclass
class DeletedAccount:
    name: str
    rows: int
    users: int
    files: int


async def delete_account(account_id: uuid.UUID, *, by_user_id: uuid.UUID) -> DeletedAccount:
    """Delete an account with every row that carries its ``account_id`` and its stored files.

    Users left without any account are deleted too (so the email can register again), unless something
    outside this account still refers to them. The database part is one transaction; files go after it commits.
    """
    async with sessionmaker()() as session:
        async with session.begin():
            await session.execute(text("SELECT set_config('app.bypass_rls', 'on', true)"))
            account = await session.get(Account, account_id)
            if account is None:
                raise NotFound("Kontot ei leitud")
            name = account.name
            attachment_ids = list((await session.execute(select(Attachment.id).where(Attachment.account_id == account_id))).scalars())
            user_ids = set((await session.execute(select(Membership.user_id).where(Membership.account_id == account_id))).scalars())

            # every table with an account_id, children before parents; self-references are cut first
            tables = [t for t in reversed(Base.metadata.sorted_tables) if "account_id" in t.c and t.name != Account.__tablename__]
            for t in tables:
                own = [fk.parent for fk in t.foreign_keys if fk.column.table is t and fk.parent.nullable]
                if own:
                    await session.execute(update(t).where(t.c.account_id == account_id).values({c.name: None for c in own}))
            rows = 0
            for t in tables:
                rows += (await session.execute(delete(t).where(t.c.account_id == account_id))).rowcount or 0
            await session.delete(account)

            users = 0
            for uid in user_ids:
                if await session.scalar(select(Membership.id).where(Membership.user_id == uid).limit(1)):
                    continue
                try:
                    async with session.begin_nested():
                        await session.execute(delete(AuthSession).where(AuthSession.user_id == uid))
                        await session.execute(delete(PasswordReset).where(PasswordReset.user_id == uid))
                        await session.execute(delete(User).where(User.id == uid))
                    users += 1
                except IntegrityError:  # still referenced from another account: keep the user
                    pass

    store = blobstore()
    files = await store.delete_prefix(f"account/{account_id}/")
    await store.delete([f"derived/parking-plan/{a}.png" for a in attachment_ids])
    log.info("account.deleted", account_id=str(account_id), name=name, rows=rows, users=users, files=files, by_user_id=str(by_user_id))
    return DeletedAccount(name=name, rows=rows, users=users, files=files)
