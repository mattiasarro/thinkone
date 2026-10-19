"""The app role must survive a request that rolls back — otherwise the pooled connection is the superuser and RLS is off."""

from sqlalchemy import text
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

from app.infra.db import install_app_role
from app.infra.settings import get_settings


async def test_app_role_survives_a_rolled_back_request():
    s = get_settings()
    eng = create_async_engine(s.database_url, pool_size=1, max_overflow=0)  # one connection: the next request reuses it
    install_app_role(eng, s.db_app_role)
    sm = async_sessionmaker(eng)
    try:
        try:
            async with sm() as ses, ses.begin():
                assert (await ses.execute(text("SELECT current_user"))).scalar() == s.db_app_role
                raise LookupError("404 on the connection's first request")
        except LookupError:
            pass
        async with sm() as ses, ses.begin():
            assert (await ses.execute(text("SELECT current_user"))).scalar() == s.db_app_role
    finally:
        await eng.dispose()
