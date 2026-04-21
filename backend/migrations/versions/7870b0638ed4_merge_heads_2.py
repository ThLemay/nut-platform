"""merge_heads_2

Revision ID: 7870b0638ed4
Revises: 2645cbafa031, a1b2c3d4e5f6
Create Date: 2026-04-20 10:00:02.009542

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '7870b0638ed4'
down_revision: Union[str, None] = ('2645cbafa031', 'a1b2c3d4e5f6')
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    pass


def downgrade() -> None:
    pass
