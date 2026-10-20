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
    ("parking_spot", "real_estate", "unit", "Parkimiskoht", "app.verticals.real_estate:ParkingSpotAttributes"),
    ("department", "employment", "container", "Osakond", "app.verticals.employment:DepartmentAttributes"),
    ("position", "employment", "unit", "Ametikoht", "app.verticals.employment:PositionAttributes"),
]

CONTRACT_TYPES = [
    # annex_roles: numbered lease annexes; optional_annex_roles: appended after them only when the property has such a file
    ("lease", "real_estate", "Üürileping", {"asset_binding": "exclusive:space", "annex_roles": {"1": "floor_plan", "2": "site_plan", "3": "special_terms"},
                                            "optional_annex_roles": ["overview_plan", "parking_plan"]}),
    ("employment", "employment", "Tööleping", {"asset_binding": "quota:position"}),
    ("generic", None, "Üldine leping", {"asset_binding": "coverage:optional"}),
]

KEY_DATE_KINDS = [
    ("start", "Lepingu algus", None, 0, False, "milestone"),
    ("end", "Lepingu lõpp", None, 90, True, "milestone"),
    ("indexation", "Indekseerimine", "real_estate", 30, True, "task"),
    ("probation", "Katseaja lõpp", "employment", 14, False, "window"),
    ("salary_review", "Palgaülevaatus", "employment", 30, False, "task"),
    ("payment", "Maksetähtaeg", None, 7, False, "task"),
    ("notice", "Etteteatamise tähtaeg", None, 30, False, "window"),
    ("termination_option", "Ülesütlemisvõimalus", None, 30, False, "opens"),
    ("other", "Muu tähtaeg", None, 30, False, "window"),
]

DEFAULT_ACCOUNT_SETTINGS = {
    "notify_days": {"end": 90, "indexation": 30, "probation": 14, "salary_review": 30, "quote_expiry": 3},
    "locale": "et",
    # Phase 3 — quote defaults (demo `seVaike`): validity, lease period, deposit months, silence before a reminder,
    # share-link validity of the contract stage. VAT rates are dated (architecture §2: a config value with an effective date).
    "quote": {"validity_days": 14, "period_months": 60, "deposit_months": 3, "silence_days": 5, "contract_link_days": 30},
    "vat_rates": [{"from": "2025-07-01", "rate": 0.24}, {"from": "2024-01-01", "rate": 0.22}, {"from": "1900-01-01", "rate": 0.20}],
}


async def seed_globals(session: AsyncSession) -> None:
    """Idempotent. Runs at startup (api + worker) and in tests."""
    existing = {t.code for t in (await session.execute(select(AssetType))).scalars()}
    for code, vertical, kind, name, schema in ASSET_TYPES:
        if code not in existing:
            session.add(AssetType(code=code, vertical=vertical, kind=kind, name_et=name, schema_ref=schema))
    existing_ct = {t.code: t for t in (await session.execute(select(ContractType))).scalars()}
    for code, vertical, name, config in CONTRACT_TYPES:
        if code not in existing_ct:
            session.add(ContractType(code=code, vertical=vertical, name_et=name, config=config))
        elif existing_ct[code].config != config:  # global config is code-owned: keep deployed rows in step with the seed
            existing_ct[code].config = config
    existing_kd = {k.code: k for k in (await session.execute(select(KeyDateKind).where(KeyDateKind.account_id.is_(None)))).scalars()}
    for code, name, vertical, days, client, behaviour in KEY_DATE_KINDS:
        if code not in existing_kd:
            session.add(KeyDateKind(account_id=None, code=code, name_et=name, vertical=vertical, default_notify_days=days, notify_client=client,
                                    behaviour=behaviour))
        elif existing_kd[code].behaviour != behaviour:  # code-owned like contract types
            existing_kd[code].behaviour = behaviour
    await session.flush()


async def seed_account_defaults(session: AsyncSession, actor: Actor) -> None:
    account = await session.get(Account, actor.account_id)
    assert account
    if not account.settings:
        account.settings = dict(DEFAULT_ACCOUNT_SETTINGS)
        emit(session, actor, "account", account.id, "account.settings_seeded", account.settings)
