"""simplify_user_roles

Revision ID: a1b2c3d4e5f6
Revises: 5e2d5159bf9f
Create Date: 2026-04-20 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'a1b2c3d4e5f6'
down_revision: Union[str, None] = '5e2d5159bf9f'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1. Créer le nouvel enum d'abord
    op.execute("ALTER TYPE userrole RENAME TO userrole_old")
    op.execute("CREATE TYPE userrole AS ENUM ('admin_nut', 'gestionnaire_organisation', 'operateur', 'consommateur')")

    # 2. Migrer la colonne vers le nouvel enum
    op.execute('ALTER TABLE "user" ALTER COLUMN role TYPE userrole USING role::text::userrole')

    # 3. Supprimer l'ancien enum
    op.execute("DROP TYPE userrole_old")


def downgrade() -> None:
    op.execute("ALTER TYPE userrole RENAME TO userrole_old")
    op.execute(
        "CREATE TYPE userrole AS ENUM ("
        "'admin_nut', 'gestionnaire_organisation', 'food_provider', 'laveur', "
        "'transporteur', 'recycleur', 'destructeur', 'stockeur', 'operateur', 'consommateur')"
    )
    op.execute("ALTER TABLE \"user\" ALTER COLUMN role TYPE userrole USING role::text::userrole")
    op.execute("DROP TYPE userrole_old")
