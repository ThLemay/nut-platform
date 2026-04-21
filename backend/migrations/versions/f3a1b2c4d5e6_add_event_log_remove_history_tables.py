"""add_event_log_remove_history_tables

Revision ID: f3a1b2c4d5e6
Revises: e8d2ff4a177a
Create Date: 2026-04-15 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = 'f3a1b2c4d5e6'
down_revision: Union[str, None] = 'e8d2ff4a177a'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1. Créer les enums PostgreSQL
    eventtype = postgresql.ENUM(
        'container_scan', 'container_status_change', 'container_created',
        'credit_gain', 'credit_depense', 'credit_ajustement',
        'quality_check', 'quality_check_result',
        'order_created', 'order_status_change',
        name='eventtype',
        create_type=True,
    )
    eventtype.create(op.get_bind(), checkfirst=True)

    entitytype = postgresql.ENUM(
        'container', 'order', 'credit', 'stock', 'user',
        name='entitytype',
        create_type=True,
    )
    entitytype.create(op.get_bind(), checkfirst=True)

    # 2. Créer la table event_log
    op.create_table(
        'event_log',
        sa.Column('id',          sa.BigInteger(), autoincrement=True, nullable=False),
        sa.Column('created_at',  sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=True),
        sa.Column('id_user',     sa.BigInteger(), sa.ForeignKey('user.id'),         nullable=True),
        sa.Column('id_org',      sa.BigInteger(), sa.ForeignKey('organization.id'), nullable=True),
        sa.Column('entity_type', postgresql.ENUM('container', 'order', 'credit', 'stock', 'user', name='entitytype', create_type=False), nullable=False),
        sa.Column('entity_id',   sa.BigInteger(), nullable=False),
        sa.Column('event_type',  postgresql.ENUM(
            'container_scan', 'container_status_change', 'container_created',
            'credit_gain', 'credit_depense', 'credit_ajustement',
            'quality_check', 'quality_check_result',
            'order_created', 'order_status_change',
            name='eventtype', create_type=False,
        ), nullable=False),
        sa.Column('old_value',   postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column('new_value',   postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column('id_place',    sa.BigInteger(), sa.ForeignKey('place.id'), nullable=True),
        sa.Column('note',        sa.Text(), nullable=True),
        sa.Column('meta',        postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index('ix_event_log_created_at',  'event_log', ['created_at'])
    op.create_index('ix_event_log_entity_type', 'event_log', ['entity_type'])
    op.create_index('ix_event_log_entity_id',   'event_log', ['entity_id'])
    op.create_index('ix_event_log_event_type',  'event_log', ['event_type'])

    # 3. Supprimer les anciennes tables
    op.drop_table('container_status_history')
    op.drop_table('credit_transaction')
    op.drop_table('quality_check')


def downgrade() -> None:
    # Recréer les tables supprimées (structure minimale pour rollback)
    op.create_table(
        'quality_check',
        sa.Column('id',           sa.BigInteger(), autoincrement=True, nullable=False),
        sa.Column('id_container', sa.BigInteger(), sa.ForeignKey('container.id'), nullable=False),
        sa.Column('id_operator',  sa.BigInteger(), sa.ForeignKey('user.id'),      nullable=True),
        sa.Column('checked_at',   sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=True),
        sa.Column('result',       sa.Text(), nullable=False),
        sa.Column('note',         sa.Text(), nullable=True),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_table(
        'credit_transaction',
        sa.Column('id',           sa.BigInteger(), autoincrement=True, nullable=False),
        sa.Column('id_credit',    sa.BigInteger(), sa.ForeignKey('credit.id'),    nullable=False),
        sa.Column('id_user',      sa.BigInteger(), sa.ForeignKey('user.id'),      nullable=False),
        sa.Column('id_container', sa.BigInteger(), sa.ForeignKey('container.id'), nullable=True),
        sa.Column('type',         sa.Text(), nullable=False),
        sa.Column('amount',       sa.Numeric(10, 2), nullable=False),
        sa.Column('note',         sa.Text(), nullable=True),
        sa.Column('created_at',   sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=True),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_table(
        'container_status_history',
        sa.Column('id',                 sa.BigInteger(), autoincrement=True, nullable=False),
        sa.Column('id_container',       sa.BigInteger(), sa.ForeignKey('container.id'),    nullable=False),
        sa.Column('status',             sa.Text(), nullable=False),
        sa.Column('id_place',           sa.BigInteger(), sa.ForeignKey('place.id'),        nullable=True),
        sa.Column('id_updated_by',      sa.BigInteger(), sa.ForeignKey('user.id'),         nullable=True),
        sa.Column('changed_at',         sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=True),
        sa.Column('scan_method',        sa.String(20), nullable=True),
        sa.Column('note',               sa.Text(), nullable=True),
        sa.Column('id_responsible_org', sa.BigInteger(), sa.ForeignKey('organization.id'), nullable=True),
        sa.PrimaryKeyConstraint('id'),
    )

    # Supprimer event_log et ses index
    op.drop_index('ix_event_log_event_type',  table_name='event_log')
    op.drop_index('ix_event_log_entity_id',   table_name='event_log')
    op.drop_index('ix_event_log_entity_type', table_name='event_log')
    op.drop_index('ix_event_log_created_at',  table_name='event_log')
    op.drop_table('event_log')

    # Supprimer les enums
    op.execute('DROP TYPE IF EXISTS eventtype')
    op.execute('DROP TYPE IF EXISTS entitytype')
