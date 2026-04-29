from sqlalchemy import Column, BigInteger, String, DateTime, Integer, Boolean, ForeignKey, Enum as SAEnum
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.db.database import Base
import enum

class UserRole(str, enum.Enum):
    admin_nut                = "admin_nut"
    gestionnaire_organisation = "gestionnaire_organisation"
    operateur                = "operateur"
    consommateur             = "consommateur"

class UserStatus(str, enum.Enum):
    active   = "active"
    inactive = "inactive"
    banned   = "banned"

class User(Base):
    __tablename__ = "user"

    id              = Column(BigInteger, primary_key=True, autoincrement=True)
    firstname       = Column(String(50),  nullable=False)
    surname         = Column(String(50),  nullable=False)
    email           = Column(String(100), nullable=False, unique=True, index=True)
    hashed_password = Column(String(255), nullable=False)
    phone_number    = Column(String(20))
    role            = Column(SAEnum(UserRole), nullable=False, default=UserRole.consommateur)
    status          = Column(SAEnum(UserStatus), nullable=False, default=UserStatus.active)
    id_organization = Column(BigInteger, ForeignKey("organization.id"), nullable=True, index=True)
    creation_date   = Column(DateTime(timezone=True), server_default=func.now())
    last_login      = Column(DateTime(timezone=True))
    # Incrémenté à chaque logout / changement de password / ban → invalide tous les tokens existants.
    token_version   = Column(Integer, nullable=False, default=0, server_default="0")

    # Relations
    organization = relationship("Organization", back_populates="users")
    credit       = relationship("Credit", back_populates="user", uselist=False)
