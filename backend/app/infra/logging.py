import logging
import sys

import structlog

from app.infra.settings import get_settings


def configure_logging() -> None:
    s = get_settings()
    logging.basicConfig(stream=sys.stdout, level=s.log_level, format="%(message)s")
    structlog.configure(
        processors=[
            structlog.contextvars.merge_contextvars,
            structlog.processors.add_log_level,
            structlog.processors.TimeStamper(fmt="iso"),
            structlog.processors.JSONRenderer(),
        ],
        wrapper_class=structlog.make_filtering_bound_logger(logging.getLevelName(s.log_level)),
        logger_factory=structlog.PrintLoggerFactory(),
    )
    if s.sentry_dsn:
        import sentry_sdk

        sentry_sdk.init(dsn=s.sentry_dsn, environment=s.app_env, traces_sample_rate=0.1)


log = structlog.get_logger()
