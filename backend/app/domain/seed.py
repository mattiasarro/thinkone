"""Global config seeds (asset types, contract types, key-date kinds) + per-account defaults."""

from __future__ import annotations

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.domain.events import Actor, emit
from app.models.contracts import ContractType, KeyDateKind
from app.models.core import Account
from app.models.registry import AssetType

ASSET_TYPES = [
    ("property", "real_estate", "container", "Hoone / objekt", "app.verticals.real_estate:PropertyAttributes"),
    ("space", "real_estate", "unit", "Üüripind", "app.verticals.real_estate:SpaceAttributes"),
    ("department", "employment", "container", "Osakond", "app.verticals.employment:DepartmentAttributes"),
    ("position", "employment", "unit", "Ametikoht", "app.verticals.employment:PositionAttributes"),
]

CONTRACT_TYPES = [
    ("lease", "real_estate", "Üürileping", {"asset_binding": "exclusive:space", "annex_roles": {"1": "floor_plan", "2": "site_plan", "3": "special_terms"}}),
    ("employment", "employment", "Tööleping", {"asset_binding": "quota:position"}),
    ("generic", None, "Üldine leping", {"asset_binding": "coverage:optional"}),
]

KEY_DATE_KINDS = [
    ("start", "Lepingu algus", None, 0, False),
    ("end", "Lepingu lõpp", None, 90, True),
    ("indexation", "Indekseerimine", "real_estate", 30, True),
    ("probation", "Katseaja lõpp", "employment", 14, False),
    ("salary_review", "Palgaülevaatus", "employment", 30, False),
    ("payment", "Maksetähtaeg", None, 7, False),
    ("notice", "Etteteatamise tähtaeg", None, 30, False),
    ("other", "Muu tähtaeg", None, 30, False),
]

DEFAULT_ACCOUNT_SETTINGS = {
    "notify_days": {"end": 90, "indexation": 30, "probation": 14, "salary_review": 30, "quote_expiry": 3},
    "locale": "et",
}


async def seed_globals(session: AsyncSession) -> None:
    """Idempotent. Runs at startup (api + worker) and in tests."""
    existing = {t.code for t in (await session.execute(select(AssetType))).scalars()}
    for code, vertical, kind, name, schema in ASSET_TYPES:
        if code not in existing:
            session.add(AssetType(code=code, vertical=vertical, kind=kind, name_et=name, schema_ref=schema))
    existing = {t.code for t in (await session.execute(select(ContractType))).scalars()}
    for code, vertical, name, config in CONTRACT_TYPES:
        if code not in existing:
            session.add(ContractType(code=code, vertical=vertical, name_et=name, config=config))
    existing = {k.code for k in (await session.execute(select(KeyDateKind).where(KeyDateKind.account_id.is_(None)))).scalars()}
    for code, name, vertical, days, client in KEY_DATE_KINDS:
        if code not in existing:
            session.add(KeyDateKind(account_id=None, code=code, name_et=name, vertical=vertical, default_notify_days=days, notify_client=client))
    await session.flush()


async def seed_account_defaults(session: AsyncSession, actor: Actor) -> None:
    account = await session.get(Account, actor.account_id)
    assert account
    if not account.settings:
        account.settings = dict(DEFAULT_ACCOUNT_SETTINGS)
        emit(session, actor, "account", account.id, "account.settings_seeded", account.settings)
