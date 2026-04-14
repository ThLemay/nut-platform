"""init

Revision ID: 415736039031
Revises: 
Create Date: 2026-03-30 09:46:52.079325

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '415736039031'
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1. address
    op.create_table('address',
    sa.Column('id', sa.BigInteger(), autoincrement=True, nullable=False),
    sa.Column('address', sa.String(length=100), nullable=True),
    sa.Column('city', sa.String(length=50), nullable=True),
    sa.Column('zipcode', sa.String(length=10), nullable=True),
    sa.Column('country', sa.String(length=50), nullable=True),
    sa.Column('latitude', sa.Numeric(precision=10, scale=7), nullable=True),
    sa.Column('longitude', sa.Numeric(precision=10, scale=7), nullable=True),
    sa.PrimaryKeyConstraint('id')
    )
    # 2. organization (dépend de address)
    op.create_table('organization',
    sa.Column('id', sa.BigInteger(), autoincrement=True, nullable=False),
    sa.Column('name', sa.String(length=100), nullable=False),
    sa.Column('siren', sa.String(length=9), nullable=True),
    sa.Column('siret', sa.String(length=14), nullable=True),
    sa.Column('description', sa.Text(), nullable=True),
    sa.Column('status', sa.Integer(), nullable=True),
    sa.Column('creation_date', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=True),
    sa.Column('id_address', sa.BigInteger(), nullable=True),
    sa.Column('id_parent', sa.BigInteger(), nullable=True),
    sa.Column('is_food_provider', sa.Boolean(), nullable=True),
    sa.Column('is_cont_washer', sa.Boolean(), nullable=True),
    sa.Column('is_cont_transporter', sa.Boolean(), nullable=True),
    sa.Column('is_cont_stockeur', sa.Boolean(), nullable=True),
    sa.Column('is_cont_recycleur', sa.Boolean(), nullable=True),
    sa.Column('is_cont_destructeur', sa.Boolean(), nullable=True),
    sa.Column('is_cont_provider', sa.Boolean(), nullable=True),
    sa.ForeignKeyConstraint(['id_address'], ['address.id'], ),
    sa.ForeignKeyConstraint(['id_parent'], ['organization.id'], ),
    sa.PrimaryKeyConstraint('id'),
    sa.UniqueConstraint('siren'),
    sa.UniqueConstraint('siret')
    )
    # 3. place (dépend de address, organization)
    op.create_table('place',
    sa.Column('id', sa.BigInteger(), autoincrement=True, nullable=False),
    sa.Column('name', sa.String(length=100), nullable=False),
    sa.Column('place_type', sa.Enum('restaurant', 'cuisine_collective', 'laveur', 'entrepot', 'point_collecte', 'centre_commercial', 'camion', 'recycleur', 'destructeur', 'autre', name='placetypeenum'), nullable=False),
    sa.Column('id_organization', sa.BigInteger(), nullable=True),
    sa.Column('id_address', sa.BigInteger(), nullable=True),
    sa.Column('id_parent', sa.BigInteger(), nullable=True),
    sa.Column('latitude', sa.Numeric(precision=10, scale=7), nullable=True),
    sa.Column('longitude', sa.Numeric(precision=10, scale=7), nullable=True),
    sa.Column('volume_capacity', sa.Numeric(precision=10, scale=2), nullable=True),
    sa.ForeignKeyConstraint(['id_address'], ['address.id'], ),
    sa.ForeignKeyConstraint(['id_organization'], ['organization.id'], ),
    sa.ForeignKeyConstraint(['id_parent'], ['place.id'], ),
    sa.PrimaryKeyConstraint('id')
    )
    # 4. container_type
    op.create_table('container_type',
    sa.Column('id', sa.BigInteger(), autoincrement=True, nullable=False),
    sa.Column('name', sa.String(length=100), nullable=False),
    sa.Column('description', sa.Text(), nullable=True),
    sa.Column('literage', sa.Numeric(precision=6, scale=2), nullable=True),
    sa.Column('weight', sa.Numeric(precision=6, scale=3), nullable=True),
    sa.Column('width', sa.Numeric(precision=8, scale=2), nullable=True),
    sa.Column('length', sa.Numeric(precision=8, scale=2), nullable=True),
    sa.Column('height', sa.Numeric(precision=8, scale=2), nullable=True),
    sa.Column('stacking_height', sa.Numeric(precision=8, scale=2), nullable=True),
    sa.Column('material', sa.String(length=50), nullable=True),
    sa.Column('sealable', sa.Boolean(), nullable=True),
    sa.Column('max_wash_cycles', sa.Integer(), nullable=True),
    sa.PrimaryKeyConstraint('id')
    )
    # 5. cont_packaging_type (dépend de container_type)
    op.create_table('cont_packaging_type',
    sa.Column('id', sa.BigInteger(), autoincrement=True, nullable=False),
    sa.Column('id_cont_type', sa.BigInteger(), nullable=False),
    sa.Column('name', sa.String(length=100), nullable=True),
    sa.Column('pieces_per_bag', sa.BigInteger(), nullable=True),
    sa.Column('bag_per_box', sa.BigInteger(), nullable=True),
    sa.Column('box_per_pallet', sa.BigInteger(), nullable=True),
    sa.Column('width_box', sa.Numeric(precision=8, scale=2), nullable=True),
    sa.Column('length_box', sa.Numeric(precision=8, scale=2), nullable=True),
    sa.Column('height_box', sa.Numeric(precision=8, scale=2), nullable=True),
    sa.Column('weight_box', sa.Numeric(precision=8, scale=3), nullable=True),
    sa.ForeignKeyConstraint(['id_cont_type'], ['container_type.id'], ),
    sa.PrimaryKeyConstraint('id')
    )
    # 6. user (dépend de organization)
    op.create_table('user',
    sa.Column('id', sa.BigInteger(), autoincrement=True, nullable=False),
    sa.Column('firstname', sa.String(length=50), nullable=False),
    sa.Column('surname', sa.String(length=50), nullable=False),
    sa.Column('email', sa.String(length=100), nullable=False),
    sa.Column('hashed_password', sa.String(length=255), nullable=False),
    sa.Column('phone_number', sa.String(length=20), nullable=True),
    sa.Column('role', sa.Enum('admin_nut', 'gestionnaire_org', 'food_provider', 'laveur', 'transporteur', 'recycleur', 'destructeur', 'stockeur', 'operateur', 'consommateur', name='userrole'), nullable=False),
    sa.Column('status', sa.Enum('active', 'inactive', 'banned', name='userstatus'), nullable=False),
    sa.Column('id_organization', sa.BigInteger(), nullable=True),
    sa.Column('creation_date', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=True),
    sa.Column('last_login', sa.DateTime(timezone=True), nullable=True),
    sa.ForeignKeyConstraint(['id_organization'], ['organization.id'], ),
    sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_user_email'), 'user', ['email'], unique=True)
    # 7. credit (dépend de user, organization)
    op.create_table('credit',
    sa.Column('id', sa.BigInteger(), autoincrement=True, nullable=False),
    sa.Column('id_user', sa.BigInteger(), nullable=False),
    sa.Column('id_organization', sa.BigInteger(), nullable=True),
    sa.Column('balance', sa.Numeric(precision=10, scale=2), nullable=True),
    sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=True),
    sa.ForeignKeyConstraint(['id_organization'], ['organization.id'], ),
    sa.ForeignKeyConstraint(['id_user'], ['user.id'], ),
    sa.PrimaryKeyConstraint('id'),
    sa.UniqueConstraint('id_user')
    )
    # 8. order (dépend de organization)
    op.create_table('order',
    sa.Column('id', sa.BigInteger(), autoincrement=True, nullable=False),
    sa.Column('order_type', sa.Enum('lavage', 'transport', 'contenants', 'machine', name='ordertype'), nullable=False),
    sa.Column('status', sa.Enum('brouillon', 'envoyee', 'acceptee', 'en_cours', 'controle_qualite', 'prete', 'en_transit', 'livree', 'annulee', name='orderstatus'), nullable=False),
    sa.Column('id_client', sa.BigInteger(), nullable=False),
    sa.Column('id_provider', sa.BigInteger(), nullable=True),
    sa.Column('id_parent_order', sa.BigInteger(), nullable=True),
    sa.Column('qr_code', sa.String(length=255), nullable=True),
    sa.Column('order_date', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=True),
    sa.Column('desired_date', sa.DateTime(timezone=True), nullable=True),
    sa.Column('confirmed_date', sa.DateTime(timezone=True), nullable=True),
    sa.Column('note', sa.Text(), nullable=True),
    sa.ForeignKeyConstraint(['id_client'], ['organization.id'], ),
    sa.ForeignKeyConstraint(['id_parent_order'], ['order.id'], ),
    sa.ForeignKeyConstraint(['id_provider'], ['organization.id'], ),
    sa.PrimaryKeyConstraint('id'),
    sa.UniqueConstraint('qr_code')
    )
    # 9. order_line (dépend de order, container_type, cont_packaging_type)
    op.create_table('order_line',
    sa.Column('id', sa.BigInteger(), autoincrement=True, nullable=False),
    sa.Column('id_order', sa.BigInteger(), nullable=False),
    sa.Column('id_cont_type', sa.BigInteger(), nullable=True),
    sa.Column('id_cont_packaging', sa.BigInteger(), nullable=True),
    sa.Column('quantity', sa.BigInteger(), nullable=True),
    sa.Column('unit_price', sa.Numeric(precision=10, scale=2), nullable=True),
    sa.Column('description', sa.Text(), nullable=True),
    sa.ForeignKeyConstraint(['id_cont_packaging'], ['cont_packaging_type.id'], ),
    sa.ForeignKeyConstraint(['id_cont_type'], ['container_type.id'], ),
    sa.ForeignKeyConstraint(['id_order'], ['order.id'], ),
    sa.PrimaryKeyConstraint('id')
    )
    # 10-11. transport SANS accepted_slot_id, puis transport_slot (dépend de transport)
    op.create_table('transport',
    sa.Column('id', sa.BigInteger(), autoincrement=True, nullable=False),
    sa.Column('id_order', sa.BigInteger(), nullable=False),
    sa.Column('id_transporter', sa.BigInteger(), nullable=True),
    sa.Column('responsible', sa.Enum('client', 'laveur', 'transporteur', name='transportresponsible'), nullable=False),
    sa.Column('id_pickup_place', sa.BigInteger(), nullable=True),
    sa.Column('id_delivery_place', sa.BigInteger(), nullable=True),
    sa.Column('is_signed', sa.Boolean(), nullable=True),
    sa.Column('signed_at', sa.DateTime(timezone=True), nullable=True),
    sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=True),
    sa.ForeignKeyConstraint(['id_delivery_place'], ['place.id'], ),
    sa.ForeignKeyConstraint(['id_order'], ['order.id'], ),
    sa.ForeignKeyConstraint(['id_pickup_place'], ['place.id'], ),
    sa.ForeignKeyConstraint(['id_transporter'], ['organization.id'], ),
    sa.PrimaryKeyConstraint('id'),
    sa.UniqueConstraint('id_order')
    )
    op.create_table('transport_slot',
    sa.Column('id', sa.BigInteger(), autoincrement=True, nullable=False),
    sa.Column('id_transport', sa.BigInteger(), nullable=False),
    sa.Column('slot_date', sa.DateTime(timezone=True), nullable=False),
    sa.Column('is_accepted', sa.Boolean(), nullable=True),
    sa.ForeignKeyConstraint(['id_transport'], ['transport.id'], ),
    sa.PrimaryKeyConstraint('id')
    )
    # 12-13. Résolution de la dépendance circulaire transport <-> transport_slot
    op.add_column('transport', sa.Column('accepted_slot_id', sa.BigInteger(), nullable=True))
    op.create_foreign_key('fk_transport_accepted_slot', 'transport', 'transport_slot', ['accepted_slot_id'], ['id'])
    # 14. stock (dépend de place, order)
    op.create_table('stock',
    sa.Column('id', sa.BigInteger(), autoincrement=True, nullable=False),
    sa.Column('name', sa.String(length=100), nullable=True),
    sa.Column('status', sa.Enum('en_cours', 'ferme', 'en_transit', 'archive', name='stockstatus'), nullable=False),
    sa.Column('id_place', sa.BigInteger(), nullable=True),
    sa.Column('id_order', sa.BigInteger(), nullable=True),
    sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=True),
    sa.Column('note', sa.Text(), nullable=True),
    sa.ForeignKeyConstraint(['id_order'], ['order.id'], ),
    sa.ForeignKeyConstraint(['id_place'], ['place.id'], ),
    sa.PrimaryKeyConstraint('id')
    )
    # 15. container (dépend de container_type, place, stock)
    op.create_table('container',
    sa.Column('id', sa.BigInteger(), autoincrement=True, nullable=False),
    sa.Column('uid', sa.String(length=100), nullable=False),
    sa.Column('id_cont_type', sa.BigInteger(), nullable=False),
    sa.Column('status', sa.Enum('propre', 'utilise', 'sale', 'en_lavage', 'en_transit', 'perdu', 'a_detruire', 'detruit', name='containerstatus'), nullable=False),
    sa.Column('id_current_place', sa.BigInteger(), nullable=True),
    sa.Column('id_current_stock', sa.BigInteger(), nullable=True),
    sa.Column('creation_date', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=True),
    sa.Column('total_wash_count', sa.Integer(), nullable=True),
    sa.Column('total_km', sa.Numeric(precision=10, scale=2), nullable=True),
    sa.Column('is_active', sa.Boolean(), nullable=True),
    sa.ForeignKeyConstraint(['id_cont_type'], ['container_type.id'], ),
    sa.ForeignKeyConstraint(['id_current_place'], ['place.id'], ),
    sa.ForeignKeyConstraint(['id_current_stock'], ['stock.id'], ),
    sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_container_uid'), 'container', ['uid'], unique=True)
    # 16. container_status_history (dépend de container, place, user)
    op.create_table('container_status_history',
    sa.Column('id', sa.BigInteger(), autoincrement=True, nullable=False),
    sa.Column('id_container', sa.BigInteger(), nullable=False),
    sa.Column('status', sa.Enum('propre', 'utilise', 'sale', 'en_lavage', 'en_transit', 'perdu', 'a_detruire', 'detruit', name='containerstatus'), nullable=False),
    sa.Column('id_place', sa.BigInteger(), nullable=True),
    sa.Column('id_updated_by', sa.BigInteger(), nullable=True),
    sa.Column('changed_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=True),
    sa.Column('scan_method', sa.String(length=20), nullable=True),
    sa.Column('note', sa.Text(), nullable=True),
    sa.ForeignKeyConstraint(['id_container'], ['container.id'], ),
    sa.ForeignKeyConstraint(['id_place'], ['place.id'], ),
    sa.ForeignKeyConstraint(['id_updated_by'], ['user.id'], ),
    sa.PrimaryKeyConstraint('id')
    )
    # 17. credit_transaction (dépend de credit, user, container)
    op.create_table('credit_transaction',
    sa.Column('id', sa.BigInteger(), autoincrement=True, nullable=False),
    sa.Column('id_credit', sa.BigInteger(), nullable=False),
    sa.Column('id_user', sa.BigInteger(), nullable=False),
    sa.Column('id_container', sa.BigInteger(), nullable=True),
    sa.Column('type', sa.Enum('gain', 'depense', 'ajustement', name='credittransactiontype'), nullable=False),
    sa.Column('amount', sa.Numeric(precision=10, scale=2), nullable=False),
    sa.Column('note', sa.Text(), nullable=True),
    sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=True),
    sa.ForeignKeyConstraint(['id_container'], ['container.id'], ),
    sa.ForeignKeyConstraint(['id_credit'], ['credit.id'], ),
    sa.ForeignKeyConstraint(['id_user'], ['user.id'], ),
    sa.PrimaryKeyConstraint('id')
    )
    # 18. stock_container (dépend de stock, container)
    op.create_table('stock_container',
    sa.Column('id', sa.BigInteger(), autoincrement=True, nullable=False),
    sa.Column('id_stock', sa.BigInteger(), nullable=False),
    sa.Column('id_container', sa.BigInteger(), nullable=False),
    sa.Column('added_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=True),
    sa.Column('removed_at', sa.DateTime(timezone=True), nullable=True),
    sa.ForeignKeyConstraint(['id_container'], ['container.id'], ),
    sa.ForeignKeyConstraint(['id_stock'], ['stock.id'], ),
    sa.PrimaryKeyConstraint('id')
    )


def downgrade() -> None:
    # Inverse strict de upgrade()
    # 18
    op.drop_table('stock_container')
    # 17
    op.drop_table('credit_transaction')
    # 16
    op.drop_table('container_status_history')
    # 15
    op.drop_index(op.f('ix_container_uid'), table_name='container')
    op.drop_table('container')
    # 14
    op.drop_table('stock')
    # 13-12
    op.drop_constraint('fk_transport_accepted_slot', 'transport', type_='foreignkey')
    op.drop_column('transport', 'accepted_slot_id')
    # 11
    op.drop_table('transport_slot')
    # 10
    op.drop_table('transport')
    # 9
    op.drop_table('order_line')
    # 8
    op.drop_table('order')
    # 7
    op.drop_table('credit')
    # 6
    op.drop_index(op.f('ix_user_email'), table_name='user')
    op.drop_table('user')
    # 5
    op.drop_table('cont_packaging_type')
    # 4
    op.drop_table('container_type')
    # 3
    op.drop_table('place')
    # 2
    op.drop_table('organization')
    # 1
    op.drop_table('address')
