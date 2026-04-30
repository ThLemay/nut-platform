from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.db.database import get_db
from app.core.security import decode_token
from app.models.user import User, UserRole, UserStatus

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/auth/login")

async def get_current_user(
    token: str = Depends(oauth2_scheme),
    db: AsyncSession = Depends(get_db)
) -> User:
    """Vérifie le token JWT et retourne l'utilisateur connecté.

    Vérifie : signature, expiration, token_version (révocation), status actif.
    """
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Token invalide ou expiré",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = decode_token(token)
        sub = payload.get("sub")
        if sub is None:
            raise credentials_exception
        user_id = int(sub)
        token_tv = payload.get("tv")
    except (ValueError, TypeError):
        raise credentials_exception

    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()

    if user is None:
        raise credentials_exception

    # Révocation : si tv du token != tv courant de l'user, le token est révoqué.
    if token_tv is None or token_tv != user.token_version:
        raise credentials_exception

    # Compte non actif : 401 (pas 403) — coté client, déclenche un logout.
    if user.status != UserStatus.active:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Compte inactif ou suspendu",
            headers={"WWW-Authenticate": "Bearer"},
        )

    return user

def require_role(*roles):
    """Vérifie que l'utilisateur a le bon rôle."""
    async def role_checker(current_user: User = Depends(get_current_user)):
        if current_user.role not in roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Accès refusé. Rôles autorisés : {list(roles)}"
            )
        return current_user
    return role_checker


# ── Helpers d'autorisation standardisés ────────────────────────────────────
# À utiliser comme dépendance directe dans les signatures de handlers :
#     current_user: User = Depends(require_admin)
# Centralisé ici pour éviter les duplications dans chaque router.

def require_admin(current_user: User = Depends(get_current_user)) -> User:
    if current_user.role != UserRole.admin_nut:
        raise HTTPException(status_code=403, detail="Accès réservé admin_nut")
    return current_user


def require_admin_or_gestionnaire(current_user: User = Depends(get_current_user)) -> User:
    if current_user.role not in (UserRole.admin_nut, UserRole.gestionnaire_organisation):
        raise HTTPException(status_code=403, detail="Accès réservé admin_nut ou gestionnaire_organisation")
    return current_user


def require_not_consommateur(current_user: User = Depends(get_current_user)) -> User:
    if current_user.role == UserRole.consommateur:
        raise HTTPException(status_code=403, detail="Accès refusé")
    return current_user
