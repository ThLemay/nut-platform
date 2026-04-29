"""add performance indexes

Revision ID: 7c4d9e2a1b3f
Revises: 3f5a8b1c2d4e
Create Date: 2026-04-28 12:30:00.000000

Indexes alignés sur les patterns de lecture chauds :
  - dashboard (counts par statut, filtres org)
  - list_orders / list_containers (filtres status + org)
  - container history (entity_type, entity_id, created_at)
  - lookups stock_container (id_stock, id_container)
"""
from typing import Sequence, Union

from alembic import op


# revision identifiers, used by Alembic.
revision: str = '7c4d9e2a1b3f'
down_revision: Union[str, None] = '3f5a8b1c2d4e'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Container — dashboard counts + list filters
    op.create_index('ix_container_is_active_status', 'container', ['is_active', 'status'])
    op.create_index('ix_container_owner_active_status', 'container', ['id_owner_organization', 'is_active', 'status'])
    op.create_index('ix_container_id_cont_type', 'container', ['id_cont_type'])

    # Order — dashboard + list_orders + accept/broadcast lookups
    op.create_index('ix_order_status', 'order', ['status'])
    op.create_index('ix_order_id_client_status', 'order', ['id_client', 'status'])
    op.create_index('ix_order_id_provider_status', 'order', ['id_provider', 'status'])
    op.create_index('ix_order_order_date', 'order', ['order_date'])
    op.create_index('ix_order_desired_date', 'order', ['desired_date'])

    # EventLog — container history (entity_type, entity_id, created_at DESC)
    op.create_index('ix_event_log_entity', 'event_log', ['entity_type', 'entity_id', 'created_at'])

    # StockContainer — FKs sans index auto en Postgres
    op.create_index('ix_stock_container_id_stock', 'stock_container', ['id_stock'])
    op.create_index('ix_stock_container_id_container', 'stock_container', ['id_container'])

    # Stock — list_stocks par owner
    op.create_index('ix_stock_id_owner_organization', 'stock', ['id_owner_organization'])

    # User — counts par org dans dashboard
    op.create_index('ix_user_id_organization', 'user', ['id_organization'])


def downgrade() -> None:
    op.drop_index('ix_user_id_organization', table_name='user')
    op.drop_index('ix_stock_id_owner_organization', table_name='stock')
    op.drop_index('ix_stock_container_id_container', table_name='stock_container')
    op.drop_index('ix_stock_container_id_stock', table_name='stock_container')
    op.drop_index('ix_event_log_entity', table_name='event_log')
    op.drop_index('ix_order_desired_date', table_name='order')
    op.drop_index('ix_order_order_date', table_name='order')
    op.drop_index('ix_order_id_provider_status', table_name='order')
    op.drop_index('ix_order_id_client_status', table_name='order')
    op.drop_index('ix_order_status', table_name='order')
    op.drop_index('ix_container_id_cont_type', table_name='container')
    op.drop_index('ix_container_owner_active_status', table_name='container')
    op.drop_index('ix_container_is_active_status', table_name='container')
