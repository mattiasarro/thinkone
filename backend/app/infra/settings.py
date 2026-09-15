"""12-factor settings — every environment-specific value is an env var (architecture §9)."""

from __future__ import annotations

from functools import lru_cache
from typing import Literal

from pydantic import Field, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    app_env: Literal["dev", "test", "prod"] = "dev"
    public_url: str = "http://localhost:3000"
    api_public_url: str = "http://localhost:8000"
    secret_key: str = Field(default="dev-secret-change-me", min_length=16)
    cors_origins: str = "http://localhost:3000"

    database_url: str = "postgresql+asyncpg://thinkone:thinkone@localhost:55433/thinkone"
    # RLS is bypassed by superusers (Railway's default user is one). App sessions therefore
    # SET ROLE to this NOBYPASSRLS role, created by the first migration. Empty = disabled.
    db_app_role: str = "thinkone_app"

    # object storage — S3 API (Cloudflare R2 in prod, MinIO locally)
    s3_endpoint: str | None = "http://localhost:9000"
    s3_bucket: str = "thinkone"
    s3_key: str | None = "minio"
    s3_secret: str | None = "minio12345"
    s3_region: str = "auto"

    # LLM — Anthropic API behind the ChatModel seam
    anthropic_api_key: str | None = None
    llm_model: str = "claude-opus-5"
    llm_mode: Literal["fake", "live"] = "fake"

    # integrations: one switch, per-adapter overrides
    integrations_mode: Literal["fake", "live"] = "fake"
    ariregister_mode: Literal["fake", "live"] | None = None
    ehr_mode: Literal["fake", "live"] | None = None

    # email
    email_provider: Literal["fake", "postmark", "smtp"] = "fake"
    postmark_token: str | None = None
    postmark_webhook_secret: str | None = None
    smtp_url: str | None = None
    email_from: str = "ThinkOne <noreply@thinkone.local>"

    sentry_dsn: str | None = None
    log_level: str = "INFO"

    upload_max_bytes: int = 25 * 1024 * 1024

    @field_validator("database_url")
    @classmethod
    def _asyncpg_scheme(cls, v: str) -> str:
        # Railway hands out postgresql://…; SQLAlchemy async needs the asyncpg driver in the scheme.
        if v.startswith("postgres://"):
            v = "postgresql://" + v[len("postgres://"):]
        if v.startswith("postgresql://"):
            v = "postgresql+asyncpg://" + v[len("postgresql://"):]
        return v

    def sync_database_url(self) -> str:
        """psycopg URL for Alembic / Procrastinate."""
        return self.database_url.replace("postgresql+asyncpg://", "postgresql://").replace(
            "postgresql+psycopg://", "postgresql://"
        )

    def mode_for(self, adapter: str) -> str:
        return getattr(self, f"{adapter}_mode", None) or self.integrations_mode


@lru_cache
def get_settings() -> Settings:
    return Settings()
