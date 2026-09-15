from __future__ import annotations

from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.domain.errors import DomainError, ValidationFailed
from app.infra.logging import configure_logging
from app.infra.settings import get_settings


@asynccontextmanager
async def lifespan(app: FastAPI):
    configure_logging()
    from app.infra.db import dispose, sessionmaker
    from app.domain.seed import seed_globals

    async with sessionmaker()() as s:
        async with s.begin():
            await seed_globals(s)
    yield
    await dispose()


def create_app() -> FastAPI:
    s = get_settings()
    app = FastAPI(title="ThinkOne API", version="0.2.0", lifespan=lifespan, docs_url="/api/docs", openapi_url="/api/openapi.json")
    app.add_middleware(CORSMiddleware, allow_origins=[o.strip() for o in s.cors_origins.split(",")], allow_credentials=True,
                       allow_methods=["*"], allow_headers=["*"])

    @app.exception_handler(DomainError)
    async def _domain_error(request: Request, exc: DomainError):
        body = {"detail": exc.message, "code": exc.code}
        if isinstance(exc, ValidationFailed):
            body["errors"] = exc.errors
        return JSONResponse(status_code=exc.status_code, content=body)

    @app.get("/api/health", tags=["meta"])
    async def health():
        return {"status": "ok", "env": s.app_env}

    from app.api.operator import router as operator_router

    app.include_router(operator_router, prefix="/api/v1")
    return app


app = create_app()
