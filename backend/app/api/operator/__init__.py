from fastapi import APIRouter

from app.api.operator import auth, notifications

router = APIRouter()
router.include_router(auth.router)
router.include_router(notifications.router)
