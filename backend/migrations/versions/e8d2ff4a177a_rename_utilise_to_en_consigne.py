"""rename_utilise_to_en_consigne

Revision ID: e8d2ff4a177a
Revises: abc05f03ad47
Create Date: 2026-03-31 13:05:27.930446

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'e8d2ff4a177a'
down_revision: Union[str, None] = 'abc05f03ad47'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute("ALTER TYPE containerstatus RENAME VALUE 'utilise' TO 'en_consigne'")


def downgrade() -> None:
    op.execute("ALTER TYPE containerstatus RENAME VALUE 'en_consigne' TO 'utilise'")
