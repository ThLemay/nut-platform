"""merge_heads

Revision ID: 5e2d5159bf9f
Revises: 136739e13be2, f3a1b2c4d5e6
Create Date: 2026-04-15 14:18:00.387890

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '5e2d5159bf9f'
down_revision: Union[str, None] = ('136739e13be2', 'f3a1b2c4d5e6')
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    pass


def downgrade() -> None:
    pass
