"""Phase 3 — platform contract drafts: contract terms/round/quote link, clause draft fields, clause threads, rounds

Revision ID: 8e1f2c3d4b55
Revises: 5d2e8b1c4a77
Create Date: 2026-10-14 09:00:00
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from app.infra.rls import disable_rls_sql, enable_rls_sql

revision = '8e1f2c3d4b55'
down_revision = '5d2e8b1c4a77'
branch_labels = None
depends_on = None

NEW_TABLES = ["clause_thread", "contract_round"]


def upgrade() -> None:
    op.add_column('contract', sa.Column('quote_id', sa.UUID(), nullable=True))
    op.create_index('ix_contract_quote_id', 'contract', ['quote_id'])
    op.add_column('contract', sa.Column('terms', postgresql.JSONB(), server_default='{}', nullable=False))
    op.add_column('contract', sa.Column('contact', postgresql.JSONB(), server_default='{}', nullable=False))
    op.add_column('contract', sa.Column('sent_version', sa.Integer(), server_default='0', nullable=False))
    op.add_column('contract', sa.Column('round', postgresql.JSONB(), nullable=True))
    op.add_column('contract', sa.Column('sent_at', sa.DateTime(timezone=True), nullable=True))
    op.add_column('contract', sa.Column('accepted_at', sa.DateTime(timezone=True), nullable=True))
    op.add_column('clause', sa.Column('original_text', sa.Text(), nullable=True))
    op.add_column('clause', sa.Column('fact_key', sa.String(length=60), nullable=True))
    op.add_column('clause', sa.Column('status', sa.String(length=20), nullable=True))
    op.add_column('clause', sa.Column('origin_note', sa.String(length=200), nullable=True))
    op.add_column('clause', sa.Column('overrides_label', sa.String(length=200), nullable=True))

    op.create_table(
        'clause_thread',
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('account_id', sa.UUID(), sa.ForeignKey('account.id'), nullable=False),
        sa.Column('contract_id', sa.UUID(), sa.ForeignKey('contract.id'), nullable=False),
        sa.Column('clause_id', sa.UUID(), sa.ForeignKey('clause.id'), nullable=False),
        sa.Column('opened_by', sa.String(length=20), nullable=False),
        sa.Column('status', sa.String(length=30), server_default='open', nullable=False),
        sa.Column('resolution', sa.String(length=30), nullable=True),
        sa.Column('proposal', postgresql.JSONB(), nullable=True),
        sa.Column('wish', postgresql.JSONB(), nullable=True),
        sa.Column('round_nr', sa.Integer(), nullable=True),
        sa.Column('resolved_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.PrimaryKeyConstraint('id'),
    )
    for col in ('account_id', 'contract_id', 'clause_id'):
        op.create_index(f'ix_clause_thread_{col}', 'clause_thread', [col])
    op.create_index('ix_clause_thread_contract', 'clause_thread', ['contract_id', 'status'])

    op.create_table(
        'contract_round',
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('account_id', sa.UUID(), sa.ForeignKey('account.id'), nullable=False),
        sa.Column('contract_id', sa.UUID(), sa.ForeignKey('contract.id'), nullable=False),
        sa.Column('nr', sa.Integer(), nullable=False),
        sa.Column('side', sa.String(length=20), nullable=False),
        sa.Column('body', sa.Text(), nullable=True),
        sa.Column('version_no', sa.Integer(), nullable=True),
        sa.Column('thread_ids', postgresql.JSONB(), server_default='[]', nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('created_by', sa.UUID(), nullable=True),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('contract_id', 'nr', name='uq_contract_round'),
    )
    for col in ('account_id', 'contract_id'):
        op.create_index(f'ix_contract_round_{col}', 'contract_round', [col])
    for table in NEW_TABLES:
        for stmt in enable_rls_sql(table):
            op.execute(stmt)


def downgrade() -> None:
    for table in reversed(NEW_TABLES):
        for stmt in disable_rls_sql(table):
            op.execute(stmt)
        op.drop_table(table)
    for col in ('overrides_label', 'origin_note', 'status', 'fact_key', 'original_text'):
        op.drop_column('clause', col)
    for col in ('accepted_at', 'sent_at', 'round', 'sent_version', 'contact', 'terms'):
        op.drop_column('contract', col)
    op.drop_index('ix_contract_quote_id', table_name='contract')
    op.drop_column('contract', 'quote_id')
