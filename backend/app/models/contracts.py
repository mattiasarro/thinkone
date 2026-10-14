"""Contract engine core: contract types, contracts, versioned facts, clause tree, key dates, imports."""

from __future__ import annotations

import uuid
from datetime import date, datetime
from typing import Any

from sqlalchemy import (
    Boolean,
    Date,
    DateTime,
    ForeignKey,
    Index,
    Integer,
    String,
    Text,
    UniqueConstraint,
    func,
    text,
)
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, SoftDeleteMixin, TenantMixin, TimestampMixin, tenant_table, uuid_pk


class ContractType(Base):
    """Global config: vertical?, template kinds, parameter schema, key-date kinds, asset-binding rule."""

    __tablename__ = "contract_type"
    id: Mapped[uuid.UUID] = uuid_pk()
    code: Mapped[str] = mapped_column(String(40), unique=True)  # lease | employment | generic
    vertical: Mapped[str | None] = mapped_column(String(40), nullable=True)
    name_et: Mapped[str] = mapped_column(String(100))
    config: Mapped[dict[str, Any]] = mapped_column(JSONB, default=dict, server_default="{}")


class Contract(Base, TenantMixin, TimestampMixin, SoftDeleteMixin):
    __tablename__ = tenant_table("contract")
    __table_args__ = (Index("ix_contract_account_status", "account_id", "status"),)
    id: Mapped[uuid.UUID] = uuid_pk()
    number: Mapped[str] = mapped_column(String(40), index=True)  # human id (LEP-2023-029)
    contract_type_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("contract_type.id"))
    type_code: Mapped[str] = mapped_column(String(40), index=True)
    category: Mapped[str | None] = mapped_column(String(40), nullable=True)  # lease | maintenance | management | insurance | security | other
    company_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("company.id"), nullable=True, index=True)
    title: Mapped[str] = mapped_column(String(300))
    status: Mapped[str] = mapped_column(String(30), index=True)  # draft | ... | active | ended | cancelled | early_terminated
    origin: Mapped[str] = mapped_column(String(10))  # platform | imported
    has_clause_tree: Mapped[bool] = mapped_column(Boolean, default=False, server_default="false")
    signed_at: Mapped[date | None] = mapped_column(Date, nullable=True)
    start_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    end_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    # current-value projection of contract_fact (invariant 2); write path updates both atomically
    current_values: Mapped[dict[str, Any]] = mapped_column(JSONB, default=dict, server_default="{}")
    version: Mapped[int] = mapped_column(Integer, default=1, server_default="1")  # optimistic lock
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    source_document_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), nullable=True)
    # Phase 3 — platform-born drafts
    quote_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), nullable=True, index=True)
    # the deal (tehing) the main terms are generated from: handover, months, prices per space, deposit months, purpose,
    # parking spots per space, electrical per space, indexation, representatives {landlord: [...], tenant: [...]}
    terms: Mapped[dict[str, Any]] = mapped_column(JSONB, default=dict, server_default="{}")
    contact: Mapped[dict[str, Any]] = mapped_column(JSONB, default=dict, server_default="{}")  # client contact {name, email, phone}
    sent_version: Mapped[int] = mapped_column(Integer, default=0, server_default="0")  # last frozen document version (V1…Vn)
    round: Mapped[dict[str, Any] | None] = mapped_column(JSONB, nullable=True)  # {"nr": n, "side": "client"|"operator"} while negotiating
    sent_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    accepted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)  # client accepted every clause


class ContractParty(Base, TenantMixin, TimestampMixin):
    """contract ↔ party with the party's role in THIS contract. Exactly one row per contract is primary.

    ``valid_from``/``valid_to`` let a tenant change by amendment keep the old tenant on the history."""

    __tablename__ = tenant_table("contract_party")
    __table_args__ = (
        UniqueConstraint("contract_id", "party_id", "role", name="uq_contract_party_role"),
        Index("ix_contract_party_primary", "contract_id", unique=True, postgresql_where=text("is_primary")),
    )
    id: Mapped[uuid.UUID] = uuid_pk()
    contract_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("contract.id"), index=True)
    party_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("party.id"), index=True)
    role: Mapped[str] = mapped_column(String(30))
    is_primary: Mapped[bool] = mapped_column(Boolean, default=False, server_default="false")
    valid_from: Mapped[date | None] = mapped_column(Date, nullable=True)
    valid_to: Mapped[date | None] = mapped_column(Date, nullable=True)
    source: Mapped[str] = mapped_column(String(12), default="manual", server_default="manual")  # import | manual | amendment


class ContractFact(Base, TenantMixin):
    """Versioned facts: valid_from/valid_to, recorded_at, reason — never overwritten."""

    __tablename__ = tenant_table("contract_fact")
    __table_args__ = (Index("ix_fact_contract_key", "contract_id", "key"),)
    id: Mapped[uuid.UUID] = uuid_pk()
    contract_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("contract.id"), index=True)
    key: Mapped[str] = mapped_column(String(60))
    value: Mapped[dict[str, Any]] = mapped_column(JSONB)  # {"value": ..., "unit": ..., "text": ...}
    valid_from: Mapped[date | None] = mapped_column(Date, nullable=True)
    valid_to: Mapped[date | None] = mapped_column(Date, nullable=True)
    recorded_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    reason: Mapped[str] = mapped_column(String(20))  # initial | indexation | amendment | correction | import
    superseded_by: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), nullable=True)
    source_clause_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), nullable=True)
    provenance: Mapped[dict[str, Any] | None] = mapped_column(JSONB, nullable=True)  # {page, char_start, char_end, confidence}


class Clause(Base, TenantMixin):
    """Node in a tree. Display number is DERIVED from the tree, never stored as identity.

    ``container``: 'body' | 'annex:<n>'; ``source``: template | negotiated | imported.
    For imported contracts ``source_number`` keeps the original document's own numbering verbatim.
    """

    __tablename__ = tenant_table("clause")
    __table_args__ = (Index("ix_clause_contract_parent", "contract_id", "parent_id", "ordinal"),)
    id: Mapped[uuid.UUID] = uuid_pk()
    contract_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("contract.id"), nullable=True, index=True)
    template_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("template.id"), nullable=True, index=True)
    parent_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("clause.id"), nullable=True)
    container: Mapped[str] = mapped_column(String(20), default="body", server_default="body")
    ordinal: Mapped[int] = mapped_column(Integer)
    number_style: Mapped[str] = mapped_column(String(12), default="decimal", server_default="decimal")  # decimal | alpha | dash | none
    category: Mapped[str] = mapped_column(String(12), default="general", server_default="general")  # general | main | special
    heading: Mapped[str | None] = mapped_column(String(300), nullable=True)
    text: Mapped[dict[str, Any]] = mapped_column(JSONB, default=dict, server_default="{}")  # {"plain": "...", "doc": <TipTap JSON>}
    locked: Mapped[bool] = mapped_column(Boolean, default=False, server_default="false")
    source: Mapped[str] = mapped_column(String(12), default="template", server_default="template")
    source_number: Mapped[str | None] = mapped_column(String(30), nullable=True)
    source_template_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), nullable=True)
    overrides_clause_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("clause.id", ondelete="RESTRICT"), nullable=True)
    provenance: Mapped[dict[str, Any] | None] = mapped_column(JSONB, nullable=True)
    # Phase 3 — platform drafts: the template wording (diff base), the fact a main clause renders, Lisa 3 clause state
    original_text: Mapped[str | None] = mapped_column(Text, nullable=True)
    fact_key: Mapped[str | None] = mapped_column(String(60), nullable=True)
    status: Mapped[str | None] = mapped_column(String(20), nullable=True)  # special clauses: drafting | proposed | accepted
    origin_note: Mapped[str | None] = mapped_column(String(200), nullable=True)  # "pakkumisest" | "läbirääkimisel" | …
    overrides_label: Mapped[str | None] = mapped_column(String(200), nullable=True)  # when the override target is a main-term key, not a clause


class ClauseThread(Base, TenantMixin, TimestampMixin):
    """A discussion on one clause (demo ``arutelu``): opened by either side, resolved by the operator's choice.

    ``proposal``: {"kind": fact|wording|special_term, "fact_key", "value", "text", "target_clause_id", "special_clause_id", "by"}
    awaiting the other side's confirmation. Messages live in ``message`` with subject_type="clause_thread".
    """

    __tablename__ = tenant_table("clause_thread")
    __table_args__ = (Index("ix_clause_thread_contract", "contract_id", "status"),)
    id: Mapped[uuid.UUID] = uuid_pk()
    contract_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("contract.id"), index=True)
    clause_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("clause.id"), index=True)
    opened_by: Mapped[str] = mapped_column(String(20))  # operator | client
    status: Mapped[str] = mapped_column(String(30), default="open", server_default="open")  # open | awaiting_confirmation | resolved
    resolution: Mapped[str | None] = mapped_column(String(30), nullable=True)  # changed | special_term | explained | unchanged
    proposal: Mapped[dict[str, Any] | None] = mapped_column(JSONB, nullable=True)
    wish: Mapped[dict[str, Any] | None] = mapped_column(JSONB, nullable=True)  # the client's structured wish {"fact_key", "value"} (demo „Soovin muuta”)
    round_nr: Mapped[int | None] = mapped_column(Integer, nullable=True)  # the round whose letter published it (None = unsent)
    resolved_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)


class ContractRound(Base, TenantMixin):
    """One negotiation round = one letter (demo v707): the side that sent, the message, the document version it published."""

    __tablename__ = tenant_table("contract_round")
    __table_args__ = (UniqueConstraint("contract_id", "nr", name="uq_contract_round"),)
    id: Mapped[uuid.UUID] = uuid_pk()
    contract_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("contract.id"), index=True)
    nr: Mapped[int] = mapped_column(Integer)
    side: Mapped[str] = mapped_column(String(20))  # operator | client
    body: Mapped[str | None] = mapped_column(Text, nullable=True)
    version_no: Mapped[int | None] = mapped_column(Integer, nullable=True)
    thread_ids: Mapped[list[str]] = mapped_column(JSONB, default=list, server_default="[]")  # threads published by this letter
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default="now()")
    created_by: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), nullable=True)


class KeyDateKind(Base):
    """CONFIGURATION RECORD, not a code enum. account_id NULL = global seed."""

    __tablename__ = "key_date_kind"
    __table_args__ = (Index("ix_kdkind_code", "code"),)
    id: Mapped[uuid.UUID] = uuid_pk()
    account_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("account.id"), nullable=True)
    code: Mapped[str] = mapped_column(String(40))
    name_et: Mapped[str] = mapped_column(String(100))
    vertical: Mapped[str | None] = mapped_column(String(40), nullable=True)
    default_notify_days: Mapped[int] = mapped_column(Integer, default=30, server_default="30")
    notify_client: Mapped[bool] = mapped_column(Boolean, default=False, server_default="false")


class KeyDate(Base, TenantMixin, TimestampMixin, SoftDeleteMixin):
    __tablename__ = tenant_table("key_date")
    __table_args__ = (Index("ix_key_date_due", "account_id", "due_date"),)
    id: Mapped[uuid.UUID] = uuid_pk()
    subject_type: Mapped[str] = mapped_column(String(20), default="contract", server_default="contract")
    subject_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), index=True)
    kind_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("key_date_kind.id"))
    kind_code: Mapped[str] = mapped_column(String(40), index=True)
    title: Mapped[str] = mapped_column(String(200))
    due_date: Mapped[date] = mapped_column(Date)
    notify_days_before: Mapped[int] = mapped_column(Integer, default=30, server_default="30")
    fired_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    provenance: Mapped[dict[str, Any] | None] = mapped_column(JSONB, nullable=True)


class SourceDocument(Base, TenantMixin, TimestampMixin):
    """Imported original (PDF/DOCX/ASiC-E) — the LEGAL TRUTH for origin=imported contracts."""

    __tablename__ = tenant_table("source_document")
    id: Mapped[uuid.UUID] = uuid_pk()
    contract_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("contract.id"), nullable=True, index=True)
    filename: Mapped[str] = mapped_column(String(300))
    content_type: Mapped[str] = mapped_column(String(120))
    size: Mapped[int] = mapped_column(Integer)
    s3_key: Mapped[str] = mapped_column(String(500))
    sha256: Mapped[str] = mapped_column(String(64), index=True)
    format: Mapped[str] = mapped_column(String(10))  # pdf | docx | asice | other
    has_text_layer: Mapped[bool] = mapped_column(Boolean, default=False, server_default="false")
    page_count: Mapped[int | None] = mapped_column(Integer, nullable=True)
    container_signatures: Mapped[list[dict[str, Any]] | None] = mapped_column(JSONB, nullable=True)
    datafiles: Mapped[list[dict[str, Any]] | None] = mapped_column(JSONB, nullable=True)  # for containers
    extracted_text_s3_key: Mapped[str | None] = mapped_column(String(500), nullable=True)
    role: Mapped[str] = mapped_column(String(20), default="original", server_default="original")  # original | amendment


class ImportJob(Base, TenantMixin, TimestampMixin):
    """One upload → extraction → structuring proposal → review → commit."""

    __tablename__ = tenant_table("import_job")
    id: Mapped[uuid.UUID] = uuid_pk()
    source_document_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("source_document.id"), index=True)
    status: Mapped[str] = mapped_column(String(20), index=True)
    # uploaded | extracting | structuring | review | committed | failed | manual
    error: Mapped[str | None] = mapped_column(Text, nullable=True)
    proposal: Mapped[dict[str, Any] | None] = mapped_column(JSONB, nullable=True)  # LLM proposal (validated)
    reviewed: Mapped[dict[str, Any] | None] = mapped_column(JSONB, nullable=True)  # operator-edited proposal
    prompt_version: Mapped[str | None] = mapped_column(String(40), nullable=True)
    model: Mapped[str | None] = mapped_column(String(60), nullable=True)
    usage: Mapped[dict[str, Any] | None] = mapped_column(JSONB, nullable=True)
    duplicate_of_contract_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), nullable=True)
    committed_contract_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), nullable=True)
    created_by: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), nullable=True)
    edits_count: Mapped[int] = mapped_column(Integer, default=0, server_default="0")
