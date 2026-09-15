"""Account settings (Konto seaded): name + notify_days defaults."""

from __future__ import annotations

import uuid
from typing import Any

from sqlalchemy.ext.asyncio import AsyncSession

from app.domain.errors import DomainError, NotFound
from app.domain.events import Actor, emit
from app.domain.seed import DEFAULT_ACCOUNT_SETTINGS
from app.models.core import Account

NOTIFY_KEYS = ("end", "indexation", "probation", "salary_review", "quote_expiry")


async def get_account(session: AsyncSession, account_id: uuid.UUID) -> Account:
    account = await session.get(Account, account_id)
    if not account:
        raise NotFound("Kontot ei leitud")
    return account


def effective_settings(account: Account) -> dict[str, Any]:
    """Stored settings over the defaults, so a missing key never reaches the client."""
    merged = {**DEFAULT_ACCOUNT_SETTINGS, **(account.settings or {})}
    merged["notify_days"] = {**DEFAULT_ACCOUNT_SETTINGS["notify_days"], **((account.settings or {}).get("notify_days") or {})}
    return merged


async def update_account(
    session: AsyncSession, actor: Actor, *, name: str | None = None, settings: dict[str, Any] | None = None
) -> Account:
    account = await get_account(session, actor.account_id)
    changes: dict[str, Any] = {}
    if name is not None:
        name = name.strip()
        if not name:
            raise DomainError("Konto nimi ei tohi olla tühi")
        if name != account.name:
            changes["name"] = [account.name, name]
            account.name = name
    if settings is not None:
        current = effective_settings(account)
        notify_days = dict(current["notify_days"])
        for key, value in (settings.get("notify_days") or {}).items():
            if key not in NOTIFY_KEYS:
                raise DomainError(f"Tundmatu teavituse võti: {key}")
            if not isinstance(value, int) or value < 0 or value > 730:
                raise DomainError(f"Teavituse päevade arv peab olema 0–730 ({key})")
            notify_days[key] = value
        new_settings = {**current, **{k: v for k, v in settings.items() if k != "notify_days"}, "notify_days": notify_days}
        if new_settings != current:
            changes["settings"] = [current, new_settings]
            account.settings = new_settings
    if changes:
        emit(session, actor, "account", account.id, "account.updated", changes)
    return account
