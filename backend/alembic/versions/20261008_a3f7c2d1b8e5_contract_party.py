"""contract party join table: drop contract.party_id, link contracts to any number of parties with a role

Revision ID: a3f7c2d1b8e5
Revises: 7c1f3a2d9e40
Create Date: 2026-10-08 14:00:00
"""
from alembic import op
import sqlalchemy as sa

from app.infra.rls import disable_rls_sql, enable_rls_sql

revision = 'a3f7c2d1b8e5'
down_revision = '7c1f3a2d9e40'
branch_labels = None
depends_on = None

ROLE_CASE = ("CASE c.category WHEN 'lease' THEN 'tenant' WHEN 'employment' THEN 'employee' WHEN 'insurance' THEN 'insurer' "
             "WHEN 'maintenance' THEN 'maintainer' WHEN 'management' THEN 'manager' WHEN 'security' THEN 'security' ELSE 'supplier' END")


def upgrade() -> None:
    op.create_table(
        'contract_party',
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('account_id', sa.UUID(), nullable=False),
        sa.Column('contract_id', sa.UUID(), nullable=False),
        sa.Column('party_id', sa.UUID(), nullable=False),
        sa.Column('role', sa.String(length=30), nullable=False),
        sa.Column('is_primary', sa.Boolean(), server_default='false', nullable=False),
        sa.Column('valid_from', sa.Date(), nullable=True),
        sa.Column('valid_to', sa.Date(), nullable=True),
        sa.Column('source', sa.String(length=12), server_default='manual', nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.ForeignKeyConstraint(['account_id'], ['account.id']),
        sa.ForeignKeyConstraint(['contract_id'], ['contract.id']),
        sa.ForeignKeyConstraint(['party_id'], ['party.id']),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('contract_id', 'party_id', 'role', name='uq_contract_party_role'),
    )
    op.create_index('ix_contract_party_account_id', 'contract_party', ['account_id'], unique=False)
    op.create_index('ix_contract_party_contract_id', 'contract_party', ['contract_id'], unique=False)
    op.create_index('ix_contract_party_party_id', 'contract_party', ['party_id'], unique=False)
    op.execute("CREATE UNIQUE INDEX ix_contract_party_primary ON contract_party (contract_id) WHERE is_primary")
    # backfill: the single counterparty becomes the primary row with the category's counterparty role
    op.execute(
        "INSERT INTO contract_party (id, account_id, contract_id, party_id, role, is_primary, valid_from, source, created_at, updated_at) "
        f"SELECT gen_random_uuid(), c.account_id, c.id, c.party_id, {ROLE_CASE}, true, c.start_date, "
        "CASE c.origin WHEN 'imported' THEN 'import' ELSE 'manual' END, now(), now() "
        "FROM contract c WHERE c.party_id IS NOT NULL"
    )
    for stmt in enable_rls_sql("contract_party"):
        op.execute(stmt)
    op.drop_index('ix_contract_party_id', table_name='contract')
    op.drop_column('contract', 'party_id')


def downgrade() -> None:
    op.add_column('contract', sa.Column('party_id', sa.UUID(), nullable=True))
    op.create_foreign_key('contract_party_id_fkey', 'contract', 'party', ['party_id'], ['id'])
    op.create_index('ix_contract_party_id', 'contract', ['party_id'], unique=False)
    op.execute("UPDATE contract c SET party_id = cp.party_id FROM contract_party cp WHERE cp.contract_id = c.id AND cp.is_primary")
    for stmt in disable_rls_sql("contract_party"):
        op.execute(stmt)
    op.drop_table('contract_party')
