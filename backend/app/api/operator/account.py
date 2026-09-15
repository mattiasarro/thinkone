from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import Principal, current_principal, db
from app.domain import account as account_domain

router = APIRouter(prefix="/account", tags=["account"])


class NotifyDays(BaseModel):
    end: int = Field(ge=0, le=730)
    indexation: int = Field(ge=0, le=730)
    probation: int = Field(ge=0, le=730)
    salary_review: int = Field(ge=0, le=730)
    quote_expiry: int = Field(ge=0, le=730)


class AccountSettings(BaseModel):
    notify_days: NotifyDays
    locale: str = "et"


class AccountOut(BaseModel):
    id: uuid.UUID
    name: str
    settings: AccountSettings


class NotifyDaysPatch(BaseModel):
    end: int | None = Field(default=None, ge=0, le=730)
    indexation: int | None = Field(default=None, ge=0, le=730)
    probation: int | None = Field(default=None, ge=0, le=730)
    salary_review: int | None = Field(default=None, ge=0, le=730)
    quote_expiry: int | None = Field(default=None, ge=0, le=730)


class AccountSettingsPatch(BaseModel):
    notify_days: NotifyDaysPatch | None = None
    locale: str | None = None


class AccountPatch(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=200)
    settings: AccountSettingsPatch | None = None


@router.get("", response_model=AccountOut)
async def get_account(p: Principal = Depends(current_principal), session: AsyncSession = Depends(db)) -> AccountOut:
    a = await account_domain.get_account(session, p.account_id)
    return AccountOut(id=a.id, name=a.name, settings=AccountSettings.model_validate(account_domain.effective_settings(a)))


@router.patch("", response_model=AccountOut)
async def patch_account(body: AccountPatch, p: Principal = Depends(current_principal), session: AsyncSession = Depends(db)) -> AccountOut:
    settings = body.settings.model_dump(exclude_none=True) if body.settings else None
    a = await account_domain.update_account(session, p.actor, name=body.name, settings=settings)
    return AccountOut(id=a.id, name=a.name, settings=AccountSettings.model_validate(account_domain.effective_settings(a)))
