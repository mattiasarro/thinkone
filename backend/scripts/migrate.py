"""Release step: Alembic to head + Procrastinate schema (only when missing). Idempotent; used by the api start command."""

from __future__ import annotations

import subprocess
import sys

import psycopg

from app.infra.settings import get_settings


def main() -> None:
    subprocess.run([sys.executable, "-m", "alembic", "upgrade", "head"], check=True)
    url = get_settings().sync_database_url()
    with psycopg.connect(url, autocommit=True) as conn:
        exists = conn.execute("SELECT to_regclass('public.procrastinate_jobs')").fetchone()[0]
    if not exists:
        subprocess.run([sys.executable, "-m", "procrastinate", "--app", "app.worker.tasks.app", "schema", "--apply"], check=True)
        print("procrastinate schema applied")
    else:
        print("procrastinate schema present")
    # the app role must be able to use procrastinate's tables/functions too (created after the grant in the first migration)
    role = get_settings().db_app_role
    if role:
        with psycopg.connect(url, autocommit=True) as conn:
            conn.execute(f'GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO "{role}"')
            conn.execute(f'GRANT USAGE, SELECT, UPDATE ON ALL SEQUENCES IN SCHEMA public TO "{role}"')
            conn.execute(f'GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO "{role}"')
    print("migrations ok")


if __name__ == "__main__":
    main()
