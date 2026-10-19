"""Import desk — batches, annex/document parents, persisted checks and link decisions, exclusion

Revision ID: b7c4e2a9d1f3
Revises: a1b2c3d4e5f6
Create Date: 2026-10-19 16:00:00
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = 'b7c4e2a9d1f3'
down_revision = 'a1b2c3d4e5f6'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column('import_job', sa.Column('batch_id', sa.UUID(), nullable=True))
    op.add_column('import_job', sa.Column('parent_job_id', sa.UUID(), nullable=True))
    op.add_column('import_job', sa.Column('parent_contract_id', sa.UUID(), nullable=True))
    op.add_column('import_job', sa.Column('link', postgresql.JSONB(), nullable=True))
    op.add_column('import_job', sa.Column('checked', postgresql.JSONB(), server_default='[]', nullable=False))
    op.add_column('import_job', sa.Column('excluded_reason', sa.Text(), nullable=True))
    op.add_column('import_job', sa.Column('opened_at', sa.DateTime(timezone=True), nullable=True))
    op.create_index('ix_import_job_batch_id', 'import_job', ['batch_id'])
    # jobs from before batches: one batch per account and Tallinn day (demo impPidMigr — deterministic)
    op.execute("""
        UPDATE import_job SET batch_id = md5(account_id::text || ':' || to_char(created_at AT TIME ZONE 'Europe/Tallinn', 'YYYY-MM-DD'))::uuid
        WHERE batch_id IS NULL
    """)


def downgrade() -> None:
    op.drop_index('ix_import_job_batch_id', table_name='import_job')
    for c in ('opened_at', 'excluded_reason', 'checked', 'link', 'parent_contract_id', 'parent_job_id', 'batch_id'):
        op.drop_column('import_job', c)
