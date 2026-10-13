"""Phase 3 — quotes, document versions, share links, messages; actor_label on domain_event

Revision ID: 5d2e8b1c4a77
Revises: a3f7c2d1b8e5
Create Date: 2026-10-13 12:00:00
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from app.infra.rls import disable_rls_sql, enable_rls_sql

revision = '5d2e8b1c4a77'
down_revision = 'a3f7c2d1b8e5'
branch_labels = None
depends_on = None

NEW_TABLES = ["quote", "quote_space", "quote_special_term", "document_version", "share_link", "message"]


def _ts(name, **kw):
    return sa.Column(name, sa.DateTime(timezone=True), **kw)


def upgrade() -> None:
    op.add_column('domain_event', sa.Column('actor_label', sa.String(length=200), nullable=True))

    op.create_table(
        'quote',
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('account_id', sa.UUID(), sa.ForeignKey('account.id'), nullable=False),
        sa.Column('number', sa.String(length=40), nullable=False),
        sa.Column('company_id', sa.UUID(), sa.ForeignKey('company.id'), nullable=True),
        sa.Column('property_id', sa.UUID(), sa.ForeignKey('asset.id'), nullable=False),
        sa.Column('party_id', sa.UUID(), sa.ForeignKey('party.id'), nullable=False),
        sa.Column('status', sa.String(length=20), nullable=False),
        sa.Column('valid_until', sa.Date(), nullable=False),
        sa.Column('period_months', sa.Integer(), server_default='60', nullable=False),
        sa.Column('contact', postgresql.JSONB(), server_default='{}', nullable=False),
        sa.Column('commercial', postgresql.JSONB(), server_default='{}', nullable=False),
        sa.Column('features', postgresql.JSONB(), server_default='[]', nullable=False),
        sa.Column('totals', postgresql.JSONB(), server_default='{}', nullable=False),
        sa.Column('version', sa.Integer(), server_default='1', nullable=False),
        sa.Column('sent_version', sa.Integer(), server_default='0', nullable=False),
        _ts('sent_at', nullable=True), _ts('last_client_at', nullable=True), _ts('accepted_at', nullable=True), _ts('closed_at', nullable=True),
        sa.Column('close_reason', sa.Text(), nullable=True),
        _ts('reminded_at', nullable=True),
        sa.Column('remind_snoozed_until', sa.Date(), nullable=True),
        sa.Column('conversion', postgresql.JSONB(), nullable=True),
        sa.Column('created_by', sa.UUID(), nullable=True),
        _ts('created_at', server_default=sa.text('now()'), nullable=False), _ts('updated_at', server_default=sa.text('now()'), nullable=False),
        _ts('deleted_at', nullable=True),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('account_id', 'number', name='uq_quote_number'),
    )
    for col in ('account_id', 'company_id', 'property_id', 'party_id', 'status'):
        op.create_index(f'ix_quote_{col}', 'quote', [col])
    op.create_index('ix_quote_account_status', 'quote', ['account_id', 'status'])

    op.create_table(
        'quote_space',
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('account_id', sa.UUID(), sa.ForeignKey('account.id'), nullable=False),
        sa.Column('quote_id', sa.UUID(), sa.ForeignKey('quote.id'), nullable=False),
        sa.Column('space_id', sa.UUID(), sa.ForeignKey('asset.id'), nullable=False),
        sa.Column('ordinal', sa.Integer(), server_default='1', nullable=False),
        sa.Column('price_per_m2', sa.Float(), nullable=True),
        sa.Column('schedule', postgresql.JSONB(), nullable=True),
        sa.Column('parking_spot_ids', postgresql.JSONB(), nullable=True),
        sa.Column('parking_count', sa.Integer(), nullable=True),
        sa.Column('electrical_a', sa.Float(), nullable=True),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('quote_id', 'space_id', name='uq_quote_space'),
    )
    for col in ('account_id', 'quote_id', 'space_id'):
        op.create_index(f'ix_quote_space_{col}', 'quote_space', [col])

    op.create_table(
        'quote_special_term',
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('account_id', sa.UUID(), sa.ForeignKey('account.id'), nullable=False),
        sa.Column('quote_id', sa.UUID(), sa.ForeignKey('quote.id'), nullable=False),
        sa.Column('ordinal', sa.Integer(), server_default='1', nullable=False),
        sa.Column('text', sa.Text(), nullable=False),
        sa.Column('overrides', sa.String(length=120), nullable=True),
        sa.Column('overrides_label', sa.String(length=200), nullable=True),
        sa.Column('auto_kind', sa.String(length=30), nullable=True),
        sa.Column('space_id', sa.UUID(), nullable=True),
        sa.PrimaryKeyConstraint('id'),
    )
    for col in ('account_id', 'quote_id'):
        op.create_index(f'ix_quote_special_term_{col}', 'quote_special_term', [col])

    op.create_table(
        'document_version',
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('account_id', sa.UUID(), sa.ForeignKey('account.id'), nullable=False),
        sa.Column('subject_type', sa.String(length=20), nullable=False),
        sa.Column('subject_id', sa.UUID(), nullable=False),
        sa.Column('number', sa.Integer(), nullable=False),
        sa.Column('snapshot', postgresql.JSONB(), server_default='{}', nullable=False),
        sa.Column('snapshot_sha256', sa.String(length=64), nullable=True),
        sa.Column('pdf_s3_key', sa.String(length=500), nullable=True),
        sa.Column('pdf_sha256', sa.String(length=64), nullable=True),
        sa.Column('note', sa.Text(), nullable=True),
        _ts('created_at', server_default=sa.text('now()'), nullable=False),
        sa.Column('created_by', sa.UUID(), nullable=True),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('subject_type', 'subject_id', 'number', name='uq_document_version'),
    )
    for col in ('account_id', 'subject_type', 'subject_id'):
        op.create_index(f'ix_document_version_{col}', 'document_version', [col])

    op.create_table(
        'share_link',
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('account_id', sa.UUID(), sa.ForeignKey('account.id'), nullable=False),
        sa.Column('subject_type', sa.String(length=20), nullable=False),
        sa.Column('subject_id', sa.UUID(), nullable=False),
        sa.Column('token_hash', sa.String(length=64), nullable=False),
        sa.Column('email', sa.String(length=320), nullable=False),
        sa.Column('party_id', sa.UUID(), nullable=True),
        _ts('expires_at', nullable=False), _ts('revoked_at', nullable=True), _ts('opened_at', nullable=True), _ts('last_used_at', nullable=True),
        _ts('created_at', server_default=sa.text('now()'), nullable=False), _ts('updated_at', server_default=sa.text('now()'), nullable=False),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('token_hash', name='uq_share_link_token'),
    )
    for col in ('account_id', 'subject_type', 'subject_id'):
        op.create_index(f'ix_share_link_{col}', 'share_link', [col])

    op.create_table(
        'message',
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('account_id', sa.UUID(), sa.ForeignKey('account.id'), nullable=False),
        sa.Column('subject_type', sa.String(length=20), nullable=False),
        sa.Column('subject_id', sa.UUID(), nullable=False),
        sa.Column('channel', sa.String(length=20), server_default='chat', nullable=False),
        sa.Column('author_type', sa.String(length=20), nullable=False),
        sa.Column('author_user_id', sa.UUID(), nullable=True),
        sa.Column('author_name', sa.String(length=200), nullable=True),
        sa.Column('body', sa.Text(), nullable=False),
        sa.Column('meta', postgresql.JSONB(), server_default='{}', nullable=False),
        _ts('created_at', server_default=sa.text('now()'), nullable=False),
        _ts('read_by_operator_at', nullable=True),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index('ix_message_account_id', 'message', ['account_id'])
    op.create_index('ix_message_created_at', 'message', ['created_at'])
    op.create_index('ix_message_subject', 'message', ['subject_type', 'subject_id', 'created_at'])

    for table in NEW_TABLES:
        for stmt in enable_rls_sql(table):
            op.execute(stmt)


def downgrade() -> None:
    for table in reversed(NEW_TABLES):
        for stmt in disable_rls_sql(table):
            op.execute(stmt)
        op.drop_table(table)
    op.drop_column('domain_event', 'actor_label')
