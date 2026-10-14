"""Phase 3.3 — AI conversations are domain data (architecture §6): threads, messages, validated citations,
draft feedback and token metering. All tenant-scoped; the agent runs inside the operator's request."""

from __future__ import annotations

import uuid
from datetime import date, datetime
from typing import Any

from sqlalchemy import Date, DateTime, ForeignKey, Index, Integer, String, Text
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, SoftDeleteMixin, TenantMixin, TimestampMixin, tenant_table, uuid_pk


class AgentThread(Base, TenantMixin, TimestampMixin, SoftDeleteMixin):
    __tablename__ = tenant_table("agent_thread")
    id: Mapped[uuid.UUID] = uuid_pk()
    user_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("user.id"), nullable=True, index=True)
    title: Mapped[str] = mapped_column(String(200), default="", server_default="")
    context_type: Mapped[str | None] = mapped_column(String(20), nullable=True)  # contract | quote | party | asset | portfolio
    context_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), nullable=True)
    context_label: Mapped[str | None] = mapped_column(String(200), nullable=True)
    origin_path: Mapped[str | None] = mapped_column(String(300), nullable=True)  # the page the thread started from (context chip links back)
    last_message_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)


class AgentMessage(Base, TenantMixin):
    __tablename__ = tenant_table("agent_message")
    __table_args__ = (Index("ix_agent_message_thread", "thread_id", "created_at"),)
    id: Mapped[uuid.UUID] = uuid_pk()
    thread_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("agent_thread.id"), index=True)
    role: Mapped[str] = mapped_column(String(10))  # user | assistant
    text: Mapped[str] = mapped_column(Text, default="", server_default="")
    steps: Mapped[list[dict[str, Any]]] = mapped_column(JSONB, default=list, server_default="[]")  # tool calls: {tool, args, summary, ok}
    cards: Mapped[list[dict[str, Any]]] = mapped_column(JSONB, default=list, server_default="[]")  # answer/confirmation/clarify cards
    citations: Mapped[list[dict[str, Any]]] = mapped_column(JSONB, default=list, server_default="[]")  # validated {clause_id, number, contract_id}
    prompt_version: Mapped[str | None] = mapped_column(String(40), nullable=True)
    model: Mapped[str | None] = mapped_column(String(80), nullable=True)
    usage: Mapped[dict[str, Any]] = mapped_column(JSONB, default=dict, server_default="{}")
    status: Mapped[str] = mapped_column(String(20), default="done", server_default="done")  # streaming | done | failed | budget
    error: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default="now()")


class AgentCitation(Base, TenantMixin):
    """Answer → clause link, stored as a row (architecture §6: citations are data)."""

    __tablename__ = tenant_table("agent_citation")
    id: Mapped[uuid.UUID] = uuid_pk()
    message_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("agent_message.id"), index=True)
    contract_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), index=True)
    clause_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), index=True)
    number: Mapped[str] = mapped_column(String(30))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default="now()")


class AiDraftFeedback(Base, TenantMixin):
    """The fate of every AI draft: used | edited | discarded — captured from day 1 (architecture §6)."""

    __tablename__ = tenant_table("ai_draft_feedback")
    id: Mapped[uuid.UUID] = uuid_pk()
    message_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), nullable=True, index=True)
    card_id: Mapped[str | None] = mapped_column(String(60), nullable=True)
    kind: Mapped[str] = mapped_column(String(40))  # special_term | commercial_text | quote_draft | lease_draft | explanation | reply
    fate: Mapped[str] = mapped_column(String(20))  # used | edited | discarded
    draft_text: Mapped[str | None] = mapped_column(Text, nullable=True)
    final_text: Mapped[str | None] = mapped_column(Text, nullable=True)
    user_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default="now()")


class LlmUsage(Base, TenantMixin):
    """Token metering per run, rolled up by day per account/user (cost governance, architecture §6)."""

    __tablename__ = tenant_table("llm_usage")
    __table_args__ = (Index("ix_llm_usage_account_day", "account_id", "day"),)
    id: Mapped[uuid.UUID] = uuid_pk()
    day: Mapped[date] = mapped_column(Date, index=True)
    user_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), nullable=True)
    purpose: Mapped[str] = mapped_column(String(40))  # chat | import | plan_match | general_terms | parking_plan | draft
    model: Mapped[str | None] = mapped_column(String(80), nullable=True)
    input_tokens: Mapped[int] = mapped_column(Integer, default=0, server_default="0")
    output_tokens: Mapped[int] = mapped_column(Integer, default=0, server_default="0")
    cache_read_tokens: Mapped[int] = mapped_column(Integer, default=0, server_default="0")
    cache_write_tokens: Mapped[int] = mapped_column(Integer, default=0, server_default="0")
    runs: Mapped[int] = mapped_column(Integer, default=1, server_default="1")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default="now()")
