"""Phase 3 — risk reports

Revision ID: a1b2c3d4e5f6
Revises: 9f3a4b5c6d77
Create Date: 2026-10-14 16:00:00
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from app.infra.rls import disable_rls_sql, enable_rls_sql

revision = 'a1b2c3d4e5f6'
down_revision = '9f3a4b5c6d77'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        'risk_report',
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('account_id', sa.UUID(), sa.ForeignKey('account.id'), nullable=False),
        sa.Column('party_id', sa.UUID(), sa.ForeignKey('party.id'), nullable=False),
        sa.Column('status', sa.String(length=12), server_default='queued', nullable=False),
        sa.Column('score', sa.String(length=10), nullable=True),
        sa.Column('points', sa.Integer(), server_default='0', nullable=False),
        sa.Column('signals', postgresql.JSONB(), server_default='[]', nullable=False),
        sa.Column('sources', postgresql.JSONB(), server_default='{}', nullable=False),
        sa.Column('summary', sa.Text(), nullable=True),
        sa.Column('error', sa.Text(), nullable=True),
        sa.Column('requested_by', sa.UUID(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('generated_at', sa.DateTime(timezone=True), nullable=True),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index('ix_risk_report_account_id', 'risk_report', ['account_id'])
    op.create_index('ix_risk_report_party_id', 'risk_report', ['party_id'])
    for stmt in enable_rls_sql('risk_report'):
        op.execute(stmt)


def downgrade() -> None:
    for stmt in disable_rls_sql('risk_report'):
        op.execute(stmt)
    op.drop_table('risk_report')
