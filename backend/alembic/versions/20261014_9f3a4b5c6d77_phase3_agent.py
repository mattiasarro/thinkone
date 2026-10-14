"""Phase 3 — AI agent: threads, messages, citations, draft feedback, token metering

Revision ID: 9f3a4b5c6d77
Revises: 8e1f2c3d4b55
Create Date: 2026-10-14 14:00:00
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from app.infra.rls import disable_rls_sql, enable_rls_sql

revision = '9f3a4b5c6d77'
down_revision = '8e1f2c3d4b55'
branch_labels = None
depends_on = None

NEW_TABLES = ["agent_thread", "agent_message", "agent_citation", "ai_draft_feedback", "llm_usage"]


def _ts(name, **kw):
    return sa.Column(name, sa.DateTime(timezone=True), **kw)


def upgrade() -> None:
    op.create_table(
        'agent_thread',
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('account_id', sa.UUID(), sa.ForeignKey('account.id'), nullable=False),
        sa.Column('user_id', sa.UUID(), sa.ForeignKey('user.id'), nullable=True),
        sa.Column('title', sa.String(length=200), server_default='', nullable=False),
        sa.Column('context_type', sa.String(length=20), nullable=True),
        sa.Column('context_id', sa.UUID(), nullable=True),
        sa.Column('context_label', sa.String(length=200), nullable=True),
        sa.Column('origin_path', sa.String(length=300), nullable=True),
        _ts('last_message_at', nullable=True),
        _ts('created_at', server_default=sa.text('now()'), nullable=False), _ts('updated_at', server_default=sa.text('now()'), nullable=False), _ts('deleted_at', nullable=True),
        sa.PrimaryKeyConstraint('id'),
    )
    for col in ('account_id', 'user_id'):
        op.create_index(f'ix_agent_thread_{col}', 'agent_thread', [col])
    op.create_table(
        'agent_message',
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('account_id', sa.UUID(), sa.ForeignKey('account.id'), nullable=False),
        sa.Column('thread_id', sa.UUID(), sa.ForeignKey('agent_thread.id'), nullable=False),
        sa.Column('role', sa.String(length=10), nullable=False),
        sa.Column('text', sa.Text(), server_default='', nullable=False),
        sa.Column('steps', postgresql.JSONB(), server_default='[]', nullable=False),
        sa.Column('cards', postgresql.JSONB(), server_default='[]', nullable=False),
        sa.Column('citations', postgresql.JSONB(), server_default='[]', nullable=False),
        sa.Column('prompt_version', sa.String(length=40), nullable=True),
        sa.Column('model', sa.String(length=80), nullable=True),
        sa.Column('usage', postgresql.JSONB(), server_default='{}', nullable=False),
        sa.Column('status', sa.String(length=20), server_default='done', nullable=False),
        sa.Column('error', sa.Text(), nullable=True),
        _ts('created_at', server_default=sa.text('now()'), nullable=False),
        sa.PrimaryKeyConstraint('id'),
    )
    for col in ('account_id', 'thread_id'):
        op.create_index(f'ix_agent_message_{col}', 'agent_message', [col])
    op.create_index('ix_agent_message_thread', 'agent_message', ['thread_id', 'created_at'])
    op.create_table(
        'agent_citation',
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('account_id', sa.UUID(), sa.ForeignKey('account.id'), nullable=False),
        sa.Column('message_id', sa.UUID(), sa.ForeignKey('agent_message.id'), nullable=False),
        sa.Column('contract_id', sa.UUID(), nullable=False),
        sa.Column('clause_id', sa.UUID(), nullable=False),
        sa.Column('number', sa.String(length=30), nullable=False),
        _ts('created_at', server_default=sa.text('now()'), nullable=False),
        sa.PrimaryKeyConstraint('id'),
    )
    for col in ('account_id', 'message_id', 'contract_id', 'clause_id'):
        op.create_index(f'ix_agent_citation_{col}', 'agent_citation', [col])
    op.create_table(
        'ai_draft_feedback',
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('account_id', sa.UUID(), sa.ForeignKey('account.id'), nullable=False),
        sa.Column('message_id', sa.UUID(), nullable=True),
        sa.Column('card_id', sa.String(length=60), nullable=True),
        sa.Column('kind', sa.String(length=40), nullable=False),
        sa.Column('fate', sa.String(length=20), nullable=False),
        sa.Column('draft_text', sa.Text(), nullable=True),
        sa.Column('final_text', sa.Text(), nullable=True),
        sa.Column('user_id', sa.UUID(), nullable=True),
        _ts('created_at', server_default=sa.text('now()'), nullable=False),
        sa.PrimaryKeyConstraint('id'),
    )
    for col in ('account_id', 'message_id'):
        op.create_index(f'ix_ai_draft_feedback_{col}', 'ai_draft_feedback', [col])
    op.create_table(
        'llm_usage',
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('account_id', sa.UUID(), sa.ForeignKey('account.id'), nullable=False),
        sa.Column('day', sa.Date(), nullable=False),
        sa.Column('user_id', sa.UUID(), nullable=True),
        sa.Column('purpose', sa.String(length=40), nullable=False),
        sa.Column('model', sa.String(length=80), nullable=True),
        sa.Column('input_tokens', sa.Integer(), server_default='0', nullable=False),
        sa.Column('output_tokens', sa.Integer(), server_default='0', nullable=False),
        sa.Column('cache_read_tokens', sa.Integer(), server_default='0', nullable=False),
        sa.Column('cache_write_tokens', sa.Integer(), server_default='0', nullable=False),
        sa.Column('runs', sa.Integer(), server_default='1', nullable=False),
        _ts('created_at', server_default=sa.text('now()'), nullable=False),
        sa.PrimaryKeyConstraint('id'),
    )
    for col in ('account_id', 'day'):
        op.create_index(f'ix_llm_usage_{col}', 'llm_usage', [col])
    op.create_index('ix_llm_usage_account_day', 'llm_usage', ['account_id', 'day'])
    for table in NEW_TABLES:
        for stmt in enable_rls_sql(table):
            op.execute(stmt)


def downgrade() -> None:
    for table in reversed(NEW_TABLES):
        for stmt in disable_rls_sql(table):
            op.execute(stmt)
        op.drop_table(table)
