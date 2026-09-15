from __future__ import annotations

import uuid
from datetime import datetime
from typing import Any

from sqlalchemy import (
    BigInteger,
    Boolean,
    DateTime,
    ForeignKey,
    Index,
    Integer,
    String,
    Text,
    UniqueConstraint,
    func,
)
from sqlalchemy.dialects.postgresql import ARRAY, JSONB, TSVECTOR, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, SoftDeleteMixin, TenantMixin, TimestampMixin, tenant_table, uuid_pk


class Account(Base, TimestampMixin):
    """Konto — the tenant."""

    __tablename__ = "account"
    id: Mapped[uuid.UUID] = uuid_pk()
    name: Mapped[str] = mapped_column(String(200))
    settings: Mapped[dict[str, Any]] = mapped_column(JSONB, default=dict, server_default="{}")


class User(Base, TimestampMixin):
    """Global identity (email + password); accounts via membership."""

    __tablename__ = "user"
    id: Mapped[uuid.UUID] = uuid_pk()
    email: Mapped[str] = mapped_column(String(320), unique=True)
    name: Mapped[str] = mapped_column(String(200))
    password_hash: Mapped[str | None] = mapped_column(String(300), nullable=True)
    locale: Mapped[str] = mapped_column(String(8), default="et", server_default="et")
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, server_default="true")


class Membership(Base, TimestampMixin):
    """user ↔ account M2M with role; carries per-user notification prefs (incl. delegate)."""

    __tablename__ = tenant_table("membership")
    __table_args__ = (UniqueConstraint("account_id", "user_id", name="uq_membership"),)
    id: Mapped[uuid.UUID] = uuid_pk()
    account_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("account.id"), index=True)
    user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("user.id"), index=True)
    role: Mapped[str] = mapped_column(String(20))  # admin | operator
    invited_email: Mapped[str | None] = mapped_column(String(320), nullable=True)
    invite_token: Mapped[str | None] = mapped_column(String(120), nullable=True, unique=True)
    accepted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    notification_prefs: Mapped[dict[str, Any]] = mapped_column(JSONB, default=dict, server_default="{}")
    delegate_user_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("user.id"), nullable=True)

    user: Mapped[User] = relationship(foreign_keys=[user_id], lazy="joined")


class AuthSession(Base):
    __tablename__ = "auth_session"
    id: Mapped[uuid.UUID] = uuid_pk()
    user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("user.id"), index=True)
    account_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("account.id"), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    revoked_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)


class Company(Base, TenantMixin, TimestampMixin, SoftDeleteMixin):
    """Ettevõte / üürileandja — the account's own legal entities (registry data, branding)."""

    __tablename__ = tenant_table("company")
    id: Mapped[uuid.UUID] = uuid_pk()
    name: Mapped[str] = mapped_column(String(300))
    registry_code: Mapped[str | None] = mapped_column(String(40), nullable=True)
    vat_number: Mapped[str | None] = mapped_column(String(40), nullable=True)
    address: Mapped[str | None] = mapped_column(String(500), nullable=True)
    email: Mapped[str | None] = mapped_column(String(320), nullable=True)
    phone: Mapped[str | None] = mapped_column(String(60), nullable=True)
    accent_color: Mapped[str | None] = mapped_column(String(16), nullable=True)
    logo_attachment_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), nullable=True)
    registry_payload: Mapped[dict[str, Any] | None] = mapped_column(JSONB, nullable=True)


class Party(Base, TenantMixin, TimestampMixin, SoftDeleteMixin):
    """ONE table for every counterparty; roles as data (client | supplier | employee | ...)."""

    __tablename__ = tenant_table("party")
    id: Mapped[uuid.UUID] = uuid_pk()
    kind: Mapped[str] = mapped_column(String(20))  # ee_company | foreign_company | person
    name: Mapped[str] = mapped_column(String(300))
    registry_code: Mapped[str | None] = mapped_column(String(40), nullable=True, index=True)
    personal_code: Mapped[str | None] = mapped_column(String(40), nullable=True)
    vat_number: Mapped[str | None] = mapped_column(String(40), nullable=True)
    address: Mapped[str | None] = mapped_column(String(500), nullable=True)
    contact_name: Mapped[str | None] = mapped_column(String(200), nullable=True)
    email: Mapped[str | None] = mapped_column(String(320), nullable=True)
    phone: Mapped[str | None] = mapped_column(String(60), nullable=True)
    roles: Mapped[list[str]] = mapped_column(ARRAY(String(30)), default=list, server_default="{}")
    registry_payload: Mapped[dict[str, Any] | None] = mapped_column(JSONB, nullable=True)


class Template(Base, TenantMixin, TimestampMixin, SoftDeleteMixin):
    """general_terms | special_terms_base | quote_base — versioned, immutable once referenced.

    ``body`` for general_terms is a clause tree (list of nodes, see domain/clauses.py);
    for the other kinds a rich-text/markdown body.
    """

    __tablename__ = tenant_table("template")
    id: Mapped[uuid.UUID] = uuid_pk()
    company_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("company.id"), nullable=True)
    property_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), nullable=True)
    contract_type_code: Mapped[str] = mapped_column(String(40), default="lease", server_default="lease")
    kind: Mapped[str] = mapped_column(String(40))
    name: Mapped[str] = mapped_column(String(200))
    version: Mapped[int] = mapped_column(Integer, default=1, server_default="1")
    supersedes_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), nullable=True)
    is_current: Mapped[bool] = mapped_column(Boolean, default=True, server_default="true")
    source_attachment_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), nullable=True)
    body: Mapped[dict[str, Any]] = mapped_column(JSONB, default=dict, server_default="{}")
    node_count: Mapped[int] = mapped_column(Integer, default=0, server_default="0")


class Attachment(Base, TenantMixin, TimestampMixin, SoftDeleteMixin):
    """Polymorphic file reference → S3 key + sha256 (floor plans, site plans, logos, generic attachments)."""

    __tablename__ = tenant_table("attachment")
    id: Mapped[uuid.UUID] = uuid_pk()
    subject_type: Mapped[str] = mapped_column(String(40), index=True)  # asset | company | contract | template
    subject_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), index=True)
    role: Mapped[str] = mapped_column(String(40))  # floor_plan | site_plan | logo | generic | annex
    filename: Mapped[str] = mapped_column(String(300))
    content_type: Mapped[str] = mapped_column(String(120))
    size: Mapped[int] = mapped_column(BigInteger)
    s3_key: Mapped[str] = mapped_column(String(500))
    sha256: Mapped[str] = mapped_column(String(64))
    uploaded_by: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), nullable=True)


class DomainEvent(Base):
    """Append-only event log — invariant 1. No code path writes the DB without one."""

    __tablename__ = tenant_table("domain_event")
    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    ts: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), index=True)
    account_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("account.id"), index=True)
    actor_type: Mapped[str] = mapped_column(String(10))  # human | system | agent
    actor_user_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), nullable=True)
    on_behalf_of: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), nullable=True)
    entity_type: Mapped[str] = mapped_column(String(40))
    entity_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), nullable=True)
    action: Mapped[str] = mapped_column(String(60))
    payload: Mapped[dict[str, Any]] = mapped_column(JSONB, default=dict, server_default="{}")
    reason: Mapped[str | None] = mapped_column(Text, nullable=True)
    correlation_id: Mapped[str | None] = mapped_column(String(64), nullable=True, index=True)

    __table_args__ = (Index("ix_domain_event_entity", "entity_type", "entity_id"),)


class Notification(Base, TenantMixin, TimestampMixin):
    """In-app inbox row + email dispatch state (delivered / bounced from provider webhooks)."""

    __tablename__ = tenant_table("notification")
    id: Mapped[uuid.UUID] = uuid_pk()
    user_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("user.id"), nullable=True, index=True)
    recipient_email: Mapped[str | None] = mapped_column(String(320), nullable=True)
    kind: Mapped[str] = mapped_column(String(60))
    title: Mapped[str] = mapped_column(String(300))
    body: Mapped[str | None] = mapped_column(Text, nullable=True)
    link: Mapped[str | None] = mapped_column(String(500), nullable=True)
    subject_type: Mapped[str | None] = mapped_column(String(40), nullable=True)
    subject_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), nullable=True)
    read_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    email_status: Mapped[str] = mapped_column(String(20), default="none", server_default="none")
    # none | queued | sent | delivered | bounced | complaint
    email_message_id: Mapped[str | None] = mapped_column(String(120), nullable=True, index=True)
    email_error: Mapped[str | None] = mapped_column(Text, nullable=True)


class SearchIndex(Base):
    """Omnibox projection: one row per searchable entity, maintained by domain commands."""

    __tablename__ = tenant_table("search_index")
    __table_args__ = (
        UniqueConstraint("entity_type", "entity_id", name="uq_search_entity"),
        Index("ix_search_tsv", "tsv", postgresql_using="gin"),
    )
    id: Mapped[uuid.UUID] = uuid_pk()
    account_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("account.id"), index=True)
    entity_type: Mapped[str] = mapped_column(String(40))
    entity_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True))
    title: Mapped[str] = mapped_column(String(400))
    subtitle: Mapped[str | None] = mapped_column(String(400), nullable=True)
    text: Mapped[str] = mapped_column(Text)
    tsv: Mapped[Any] = mapped_column(TSVECTOR, nullable=True)
    link: Mapped[str] = mapped_column(String(300))
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
