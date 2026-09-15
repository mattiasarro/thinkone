"""Invariant 1: every mutation emits a ``domain_event`` in the same transaction.

Usage — every write goes through a domain command that holds an :class:`Actor` and calls
:func:`emit` before the transaction commits. api/worker/agent never write rows directly
(``tests/test_layering.py`` fails the build on naked writes outside ``app/domain``).
"""

from __future__ import annotations

import uuid
from dataclasses import dataclass, field
from typing import Any

import structlog
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.core import DomainEvent

log = structlog.get_logger()


@dataclass(frozen=True)
class Actor:
    account_id: uuid.UUID
    actor_type: str = "human"  # human | system | agent
    user_id: uuid.UUID | None = None
    on_behalf_of: uuid.UUID | None = None
    correlation_id: str | None = field(default_factory=lambda: uuid.uuid4().hex[:16])
    role: str = "operator"

    @classmethod
    def system(cls, account_id: uuid.UUID, correlation_id: str | None = None) -> Actor:
        return cls(account_id=account_id, actor_type="system", correlation_id=correlation_id or uuid.uuid4().hex[:16])


def emit(
    session: AsyncSession,
    actor: Actor,
    entity_type: str,
    entity_id: uuid.UUID | None,
    action: str,
    payload: dict[str, Any] | None = None,
    reason: str | None = None,
) -> DomainEvent:
    ev = DomainEvent(
        account_id=actor.account_id,
        actor_type=actor.actor_type,
        actor_user_id=actor.user_id,
        on_behalf_of=actor.on_behalf_of,
        entity_type=entity_type,
        entity_id=entity_id,
        action=action,
        payload=_jsonable(payload or {}),
        reason=reason,
        correlation_id=actor.correlation_id,
    )
    session.add(ev)
    log.info("domain_event", entity=entity_type, id=str(entity_id), action=action, actor=actor.actor_type)
    return ev


def _jsonable(value: Any) -> Any:
    import datetime as dt
    import decimal

    if isinstance(value, dict):
        return {str(k): _jsonable(v) for k, v in value.items()}
    if isinstance(value, list | tuple | set):
        return [_jsonable(v) for v in value]
    if isinstance(value, uuid.UUID):
        return str(value)
    if isinstance(value, dt.datetime | dt.date):
        return value.isoformat()
    if isinstance(value, decimal.Decimal):
        return float(value)
    return value
