"""Row-level security DDL for every tenant table (architecture §8).

Policy: a row is visible/writable iff ``account_id = current_setting('app.account_id')``.
``app.bypass_rls = 'on'`` (set only by trusted system code: auth lookups, worker bootstrap)
lifts the restriction inside one transaction. FORCE makes the policy apply to the table owner
too — Railway hands us one superuser-ish role, so ownership must not be an escape hatch.
"""

from __future__ import annotations

POLICY_EXPR = (
    "(current_setting('app.bypass_rls', true) = 'on') OR "
    "(account_id::text = current_setting('app.account_id', true))"
)


def enable_rls_sql(table: str) -> list[str]:
    return [
        f'ALTER TABLE "{table}" ENABLE ROW LEVEL SECURITY',
        f'ALTER TABLE "{table}" FORCE ROW LEVEL SECURITY',
        f'DROP POLICY IF EXISTS tenant_isolation ON "{table}"',
        f'CREATE POLICY tenant_isolation ON "{table}" USING ({POLICY_EXPR}) WITH CHECK ({POLICY_EXPR})',
    ]


def disable_rls_sql(table: str) -> list[str]:
    return [f'DROP POLICY IF EXISTS tenant_isolation ON "{table}"', f'ALTER TABLE "{table}" DISABLE ROW LEVEL SECURITY']


def app_role_sql(role: str) -> list[str]:
    """Create the NOBYPASSRLS application role and grant it DML on everything (present and future)."""
    return [
        f"DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = '{role}') THEN "
        f'CREATE ROLE "{role}" NOLOGIN NOBYPASSRLS; END IF; END $$',
        f'GRANT "{role}" TO current_user',
        f'GRANT USAGE ON SCHEMA public TO "{role}"',
        f'GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO "{role}"',
        f'GRANT USAGE, SELECT, UPDATE ON ALL SEQUENCES IN SCHEMA public TO "{role}"',
        f'ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO "{role}"',
        f'ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT USAGE, SELECT, UPDATE ON SEQUENCES TO "{role}"',
        f'ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT EXECUTE ON FUNCTIONS TO "{role}"',
    ]
