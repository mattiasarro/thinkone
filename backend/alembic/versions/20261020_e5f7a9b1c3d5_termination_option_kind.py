"""Key dates: a termination option that opens on a date (kind termination_option, behaviour opens)

„Esimene korralise ülesütlemise võimalus” was read as a notice deadline (a window that lapses); it is a right that opens
on the date and stays open — shown as „võimalik alates …”. Adds the global kind and moves the matching notice rows to it.

Revision ID: e5f7a9b1c3d5
Revises: d4e6f8a0b2c4
Create Date: 2026-10-20 18:00:00
"""
import sqlalchemy as sa

from alembic import op

revision = 'e5f7a9b1c3d5'
down_revision = 'd4e6f8a0b2c4'
branch_labels = None
depends_on = None


def upgrade() -> None:
    conn = op.get_bind()
    conn.execute(sa.text(
        "INSERT INTO key_date_kind (id, account_id, code, name_et, vertical, default_notify_days, notify_client, behaviour) "
        "SELECT gen_random_uuid(), NULL, 'termination_option', 'Ülesütlemisvõimalus', NULL, 30, false, 'opens' "
        "WHERE NOT EXISTS (SELECT 1 FROM key_date_kind WHERE code = 'termination_option' AND account_id IS NULL)"))
    conn.execute(sa.text(
        "UPDATE key_date SET kind_code = 'termination_option', "
        "  kind_id = (SELECT id FROM key_date_kind WHERE code = 'termination_option' AND account_id IS NULL) "
        "WHERE kind_code = 'notice' AND title ~* 'ülesütlemise\\s+võimalus'"))


def downgrade() -> None:
    conn = op.get_bind()
    conn.execute(sa.text(
        "UPDATE key_date SET kind_code = 'notice', "
        "  kind_id = (SELECT id FROM key_date_kind WHERE code = 'notice' AND account_id IS NULL) "
        "WHERE kind_code = 'termination_option'"))
    conn.execute(sa.text("DELETE FROM key_date_kind WHERE code = 'termination_option' AND account_id IS NULL"))
