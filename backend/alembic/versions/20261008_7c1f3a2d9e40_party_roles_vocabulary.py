"""party roles: drop values outside the shared vocabulary

Revision ID: 7c1f3a2d9e40
Revises: 2b95143ec937
Create Date: 2026-10-08 11:10:00
"""
from alembic import op


revision = '7c1f3a2d9e40'
down_revision = '2b95143ec937'
branch_labels = None
depends_on = None

ROLES = "ARRAY['landlord','tenant','client','supplier','manager','maintainer','security','insurer','insured','employer','employee','other']::varchar[]"


def upgrade() -> None:
    # Free-text roles entered before the pick list existed (e.g. "üürnik") don't match the enum keys; keep only known values.
    op.execute(f"UPDATE party SET roles = COALESCE((SELECT array_agg(r) FROM unnest(roles) AS r WHERE r = ANY({ROLES})), '{{}}') WHERE NOT (roles <@ {ROLES})")


def downgrade() -> None:
    pass
