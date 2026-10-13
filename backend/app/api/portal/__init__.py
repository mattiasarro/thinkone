"""Client portal API — accountless access through share links (spec v2 stage 04 p 6; architecture §8)."""

from fastapi import APIRouter

from app.api.portal import quotes

router = APIRouter(prefix="/portal", tags=["portal"])
router.include_router(quotes.router)
