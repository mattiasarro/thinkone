"""Key dates: what a passed date means (kind behaviour) and a task's outcome (done / skipped)

Global kinds get their behaviour (start/end milestone, indexation/payment/salary review task, the rest window). Later
occurrences of a series no longer repeat the first one's „Esimene …” in their title.

Revision ID: d4e6f8a0b2c4
Revises: c3d5e7f9a1b2
Create Date: 2026-10-20 14:00:00
"""
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

revision = 'd4e6f8a0b2c4'
down_revision = 'c3d5e7f9a1b2'
branch_labels = None
depends_on = None

BEHAVIOUR = {"start": "milestone", "end": "milestone", "indexation": "task", "payment": "task", "salary_review": "task"}


def upgrade() -> None:
    op.add_column('key_date_kind', sa.Column('behaviour', sa.String(12), server_default='window', nullable=False))
    op.add_column('key_date', sa.Column('resolution', sa.String(10), nullable=True))
    op.add_column('key_date', sa.Column('resolved_at', sa.DateTime(timezone=True), nullable=True))
    op.add_column('key_date', sa.Column('resolved_by', sa.UUID(), nullable=True))
    op.add_column('key_date', sa.Column('resolution_data', postgresql.JSONB(), nullable=True))
    conn = op.get_bind()
    for code, behaviour in BEHAVIOUR.items():
        conn.execute(sa.text("UPDATE key_date_kind SET behaviour = :b WHERE code = :c AND account_id IS NULL"), {"b": behaviour, "c": code})
    conn.execute(sa.text(
        "UPDATE key_date SET title = upper(left(t, 1)) || substr(t, 2) FROM ("
        "  SELECT id AS kid, regexp_replace(title, '^(esimene|esmane|first)\\s+', '', 'i') AS t FROM key_date"
        "  WHERE (provenance ? 'recurrence_of' OR provenance ? 'extended') AND title ~* '^(esimene|esmane|first)\\s+'"
        ") x WHERE key_date.id = x.kid AND x.t <> ''"))


def downgrade() -> None:
    op.drop_column('key_date', 'resolution_data')
    op.drop_column('key_date', 'resolved_by')
    op.drop_column('key_date', 'resolved_at')
    op.drop_column('key_date', 'resolution')
    op.drop_column('key_date_kind', 'behaviour')
