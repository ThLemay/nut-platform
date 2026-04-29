"""add user.token_version

Revision ID: 3f5a8b1c2d4e
Revises: dc7f0abed800
Create Date: 2026-04-28 12:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '3f5a8b1c2d4e'
down_revision: Union[str, None] = 'dc7f0abed800'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Backfill existing rows à 0 puis NOT NULL
    op.add_column(
        'user',
        sa.Column('token_version', sa.Integer(), nullable=False, server_default='0'),
    )


def downgrade() -> None:
    op.drop_column('user', 'token_version')
