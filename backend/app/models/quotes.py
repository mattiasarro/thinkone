"""Phase 3 — quotes (hinnapakkumine), frozen document versions, share links, messages.

``document_version``, ``share_link`` and ``message`` are shared by quotes and contracts through a
``subject_type/subject_id`` pair, so the contract stage reuses them without new tables.
"""

from __future__ import annotations

import uuid
from datetime import date, datetime
from typing import Any

from sqlalchemy import (
    Date,
    DateTime,
    ForeignKey,
    Index,
    Integer,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, SoftDeleteMixin, TenantMixin, TimestampMixin, tenant_table, uuid_pk


class Quote(Base, TenantMixin, TimestampMixin, SoftDeleteMixin):
    """Hinnapakkumine — property + N spaces + one client party; the first operator↔client loop."""

    __tablename__ = tenant_table("quote")
    __table_args__ = (UniqueConstraint("account_id", "number", name="uq_quote_number"), Index("ix_quote_account_status", "account_id", "status"))
    id: Mapped[uuid.UUID] = uuid_pk()
    number: Mapped[str] = mapped_column(String(40))  # PAK-2026-001
    company_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("company.id"), nullable=True, index=True)
    property_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("asset.id"), index=True)
    party_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("party.id"), index=True)
    # draft | sent | client_proposal | accepted | converted | rejected | expired | cancelled
    status: Mapped[str] = mapped_column(String(20), index=True)
    valid_until: Mapped[date] = mapped_column(Date)
    period_months: Mapped[int] = mapped_column(Integer, default=60, server_default="60")
    contact: Mapped[dict[str, Any]] = mapped_column(JSONB, default=dict, server_default="{}")  # {name, email, phone}
    commercial: Mapped[dict[str, Any]] = mapped_column(JSONB, default=dict, server_default="{}")  # {"text": "..."} (free negotiation text)
    features: Mapped[list[dict[str, Any]]] = mapped_column(JSONB, default=list, server_default="[]")  # omadused [{label, value}] — informational
    totals: Mapped[dict[str, Any]] = mapped_column(JSONB, default=dict, server_default="{}")  # projection of pricing.quote_totals
    version: Mapped[int] = mapped_column(Integer, default=1, server_default="1")  # optimistic lock
    sent_version: Mapped[int] = mapped_column(Integer, default=0, server_default="0")  # number of the last frozen version (V1…Vn)
    sent_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    last_client_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)  # last client message/action
    accepted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    closed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)  # rejected/expired/cancelled/converted
    close_reason: Mapped[str | None] = mapped_column(Text, nullable=True)
    reminded_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    remind_snoozed_until: Mapped[date | None] = mapped_column(Date, nullable=True)
    conversion: Mapped[dict[str, Any] | None] = mapped_column(JSONB, nullable=True)  # {"mode": separate|shared, "contract_ids": [...]}
    created_by: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), nullable=True)


class QuoteSpace(Base, TenantMixin):
    """One space in a quote: price override, stepped-rent schedule, parking, electrical capacity."""

    __tablename__ = tenant_table("quote_space")
    __table_args__ = (UniqueConstraint("quote_id", "space_id", name="uq_quote_space"),)
    id: Mapped[uuid.UUID] = uuid_pk()
    quote_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("quote.id"), index=True)
    space_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("asset.id"), index=True)
    ordinal: Mapped[int] = mapped_column(Integer, default=1, server_default="1")
    price_per_m2: Mapped[float | None] = mapped_column(nullable=True)  # None = the space's list price
    schedule: Mapped[list[dict[str, Any]] | None] = mapped_column(JSONB, nullable=True)  # [{"until_month": 12, "price": 7.5}, {"until_month": null, "price": 8.0}]
    parking_spot_ids: Mapped[list[str] | None] = mapped_column(JSONB, nullable=True)  # register spot asset ids (buildings with a register)
    parking_count: Mapped[int | None] = mapped_column(Integer, nullable=True)  # buildings without a register
    electrical_a: Mapped[float | None] = mapped_column(nullable=True)  # None = the space's value


class QuoteSpecialTerm(Base, TenantMixin):
    """Structured special-term items (eritingimused) — these flow into the lease's Lisa 3."""

    __tablename__ = tenant_table("quote_special_term")
    id: Mapped[uuid.UUID] = uuid_pk()
    quote_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("quote.id"), index=True)
    ordinal: Mapped[int] = mapped_column(Integer, default=1, server_default="1")
    text: Mapped[str] = mapped_column(Text)
    overrides: Mapped[str | None] = mapped_column(String(120), nullable=True)  # "main:rent" | "general:<clause id>" | free label
    overrides_label: Mapped[str | None] = mapped_column(String(200), nullable=True)  # human label („Üld · p 4.4”)
    auto_kind: Mapped[str | None] = mapped_column(String(30), nullable=True)  # stepped_rent | electricity — generated, not hand-edited
    space_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), nullable=True)


class DocumentVersion(Base, TenantMixin):
    """Invariant 3: every send-to-client freezes a snapshot + the rendered PDF (content-addressed)."""

    __tablename__ = tenant_table("document_version")
    __table_args__ = (UniqueConstraint("subject_type", "subject_id", "number", name="uq_document_version"),)
    id: Mapped[uuid.UUID] = uuid_pk()
    subject_type: Mapped[str] = mapped_column(String(20), index=True)  # quote | contract
    subject_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), index=True)
    number: Mapped[int] = mapped_column(Integer)  # V1, V2, …
    snapshot: Mapped[dict[str, Any]] = mapped_column(JSONB, default=dict, server_default="{}")
    snapshot_sha256: Mapped[str | None] = mapped_column(String(64), nullable=True)
    pdf_s3_key: Mapped[str | None] = mapped_column(String(500), nullable=True)
    pdf_sha256: Mapped[str | None] = mapped_column(String(64), nullable=True)
    note: Mapped[str | None] = mapped_column(Text, nullable=True)  # the message that went with this version
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default="now()")
    created_by: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), nullable=True)


class ShareLink(Base, TenantMixin, TimestampMixin):
    """Accountless client access: a signed, expiring grant to exactly one subject (spec v2 stage 04)."""

    __tablename__ = tenant_table("share_link")
    id: Mapped[uuid.UUID] = uuid_pk()
    subject_type: Mapped[str] = mapped_column(String(20), index=True)
    subject_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), index=True)
    token_hash: Mapped[str] = mapped_column(String(64), unique=True)
    email: Mapped[str] = mapped_column(String(320))
    party_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), nullable=True)
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    revoked_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    opened_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    last_used_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)


class Message(Base, TenantMixin):
    """CommunicationThread entry on a quote or contract. ``channel``: negotiation (proposals, replies) | chat (free talk)."""

    __tablename__ = tenant_table("message")
    __table_args__ = (Index("ix_message_subject", "subject_type", "subject_id", "created_at"),)
    id: Mapped[uuid.UUID] = uuid_pk()
    subject_type: Mapped[str] = mapped_column(String(20))
    subject_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True))
    channel: Mapped[str] = mapped_column(String(20), default="chat", server_default="chat")
    author_type: Mapped[str] = mapped_column(String(20))  # operator | client | system
    author_user_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), nullable=True)
    author_name: Mapped[str | None] = mapped_column(String(200), nullable=True)
    body: Mapped[str] = mapped_column(Text)
    meta: Mapped[dict[str, Any]] = mapped_column(JSONB, default=dict, server_default="{}")  # {version: n, kind: proposal|reply|accept|…}
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default="now()", index=True)
    read_by_operator_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
