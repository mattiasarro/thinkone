from fastapi import APIRouter

from app.api.operator import (
    account,
    assets,
    attachments,
    audit,
    auth,
    companies,
    contracts,
    imports,
    integrations,
    keydates,
    notifications,
    parties,
    portfolio,
    search,
    templates,
)

router = APIRouter()
router.include_router(auth.router)
router.include_router(notifications.router)
router.include_router(account.router)
router.include_router(companies.router)
router.include_router(integrations.router)
router.include_router(parties.router)
router.include_router(assets.router)
router.include_router(attachments.router)
router.include_router(templates.router)
router.include_router(audit.router)
router.include_router(search.router)
router.include_router(keydates.router)
router.include_router(contracts.router)
router.include_router(imports.router)
router.include_router(portfolio.router)
