"""Risk report (riskiraport) — advisory, never blocking; per-source payloads kept for the audit trail."""

from __future__ import annotations

import uuid
from datetime import datetime
from typing import Any

from sqlalchemy import DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, TenantMixin, tenant_table, uuid_pk


class RiskReport(Base, TenantMixin):
    __tablename__ = tenant_table("risk_report")
    id: Mapped[uuid.UUID] = uuid_pk()
    party_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("party.id"), index=True)
    status: Mapped[str] = mapped_column(String(12), default="queued", server_default="queued")  # queued | ready | failed
    score: Mapped[str | None] = mapped_column(String(10), nullable=True)  # KÕRGE | KESKMINE | MADAL
    points: Mapped[int] = mapped_column(Integer, default=0, server_default="0")
    signals: Mapped[list[dict[str, Any]]] = mapped_column(JSONB, default=list, server_default="[]")  # [{source, level, text}]
    sources: Mapped[dict[str, Any]] = mapped_column(JSONB, default=dict, server_default="{}")  # raw payload per source + availability
    summary: Mapped[str | None] = mapped_column(Text, nullable=True)
    error: Mapped[str | None] = mapped_column(Text, nullable=True)
    requested_by: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default="now()")
    generated_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
