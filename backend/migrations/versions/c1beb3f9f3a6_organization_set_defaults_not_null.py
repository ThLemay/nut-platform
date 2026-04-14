"""organization_set_defaults_not_null

Revision ID: c1beb3f9f3a6
Revises: e8d2ff4a177a
Create Date: 2026-04-01 07:16:44.875745

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'c1beb3f9f3a6'
down_revision: Union[str, None] = 'e8d2ff4a177a'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute("UPDATE organization SET status=1 WHERE status IS NULL")
    op.execute("UPDATE organization SET is_food_provider=false WHERE is_food_provider IS NULL")
    op.execute("UPDATE organization SET is_cont_washer=false WHERE is_cont_washer IS NULL")
    op.execute("UPDATE organization SET is_cont_transporter=false WHERE is_cont_transporter IS NULL")
    op.execute("UPDATE organization SET is_cont_stockeur=false WHERE is_cont_stockeur IS NULL")
    op.execute("UPDATE organization SET is_cont_recycleur=false WHERE is_cont_recycleur IS NULL")
    op.execute("UPDATE organization SET is_cont_destructeur=false WHERE is_cont_destructeur IS NULL")
    op.execute("UPDATE organization SET is_cont_provider=false WHERE is_cont_provider IS NULL")

    op.alter_column('organization', 'status', nullable=False, server_default='1')
    op.alter_column('organization', 'is_food_provider', nullable=False, server_default='false')
    op.alter_column('organization', 'is_cont_washer', nullable=False, server_default='false')
    op.alter_column('organization', 'is_cont_transporter', nullable=False, server_default='false')
    op.alter_column('organization', 'is_cont_stockeur', nullable=False, server_default='false')
    op.alter_column('organization', 'is_cont_recycleur', nullable=False, server_default='false')
    op.alter_column('organization', 'is_cont_destructeur', nullable=False, server_default='false')
    op.alter_column('organization', 'is_cont_provider', nullable=False, server_default='false')


def downgrade() -> None:
    op.alter_column('organization', 'status', nullable=True, server_default=None)
    op.alter_column('organization', 'is_food_provider', nullable=True, server_default=None)
    op.alter_column('organization', 'is_cont_washer', nullable=True, server_default=None)
    op.alter_column('organization', 'is_cont_transporter', nullable=True, server_default=None)
    op.alter_column('organization', 'is_cont_stockeur', nullable=True, server_default=None)
    op.alter_column('organization', 'is_cont_recycleur', nullable=True, server_default=None)
    op.alter_column('organization', 'is_cont_destructeur', nullable=True, server_default=None)
    op.alter_column('organization', 'is_cont_provider', nullable=True, server_default=None)
