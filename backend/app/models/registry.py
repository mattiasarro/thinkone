"""Asset registry (esemeregister): asset types, assets, allocations. Status is a projection."""

from __future__ import annotations

import uuid
from datetime import date
from typing import Any

from sqlalchemy import Date, ForeignKey, Index, Integer, Numeric, String, UniqueConstraint
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, SoftDeleteMixin, TenantMixin, TimestampMixin, tenant_table, uuid_pk


class AssetType(Base):
    """Global config record: vertical, kind (container | unit), attribute schema name (code)."""

    __tablename__ = "asset_type"
    id: Mapped[uuid.UUID] = uuid_pk()
    code: Mapped[str] = mapped_column(String(40), unique=True)  # property | space | department | position
    vertical: Mapped[str] = mapped_column(String(40))  # real_estate | employment
    kind: Mapped[str] = mapped_column(String(10))  # container | unit
    name_et: Mapped[str] = mapped_column(String(100))
    schema_ref: Mapped[str] = mapped_column(String(100))  # dotted path to the Pydantic schema


class Asset(Base, TenantMixin, TimestampMixin, SoftDeleteMixin):
    __tablename__ = tenant_table("asset")
    id: Mapped[uuid.UUID] = uuid_pk()
    asset_type_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("asset_type.id"), index=True)
    type_code: Mapped[str] = mapped_column(String(40), index=True)  # denormalized for cheap filters
    company_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("company.id"), nullable=True, index=True)
    parent_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("asset.id"), nullable=True, index=True)
    name: Mapped[str] = mapped_column(String(200))
    attributes: Mapped[dict[str, Any]] = mapped_column(JSONB, default=dict, server_default="{}")
    capacity: Mapped[int] = mapped_column(Integer, default=1, server_default="1")  # 1 = exclusive, N = quota

    asset_type: Mapped[AssetType] = relationship(lazy="joined")
    parent: Mapped[Asset | None] = relationship(remote_side="Asset.id", foreign_keys=[parent_id])


class Allocation(Base, TenantMixin, TimestampMixin, SoftDeleteMixin):
    """contract ↔ asset (hõive). kind: exclusive | quota | coverage."""

    __tablename__ = tenant_table("allocation")
    __table_args__ = (Index("ix_allocation_asset_period", "asset_id", "period_start", "period_end"),)
    id: Mapped[uuid.UUID] = uuid_pk()
    contract_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("contract.id"), index=True)
    asset_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("asset.id"), index=True)
    kind: Mapped[str] = mapped_column(String(12))
    quantity: Mapped[int] = mapped_column(Integer, default=1, server_default="1")
    period_start: Mapped[date | None] = mapped_column(Date, nullable=True)
    period_end: Mapped[date | None] = mapped_column(Date, nullable=True)
    area_m2: Mapped[float | None] = mapped_column(Numeric(12, 2), nullable=True)


__all__ = ["AssetType", "Asset", "Allocation", "UniqueConstraint"]
