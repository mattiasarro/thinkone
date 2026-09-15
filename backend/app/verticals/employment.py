"""Employment vertical: department (container) + position (unit, quota capacity = headcount)."""

from __future__ import annotations

from pydantic import BaseModel, Field


class DepartmentAttributes(BaseModel):
    description: str | None = None


class PositionAttributes(BaseModel):
    duties: str | None = None
    salary: float | None = Field(default=None, ge=0)
    requirements: str | None = None
    headcount: int = Field(default=1, ge=1)
