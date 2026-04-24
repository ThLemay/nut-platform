from pydantic import BaseModel, EmailStr, Field
from typing import Optional
from datetime import datetime
from app.models.user import UserRole, UserStatus


class UserOut(BaseModel):
    id: int
    firstname: str
    surname: str
    email: str
    phone_number: Optional[str]
    role: UserRole
    status: UserStatus
    id_organization: Optional[int]
    creation_date: Optional[datetime]
    model_config = {"from_attributes": True}


class UserCreate(BaseModel):
    firstname: str
    surname: str
    email: EmailStr
    password: str = Field(..., min_length=8)
    phone_number: Optional[str] = None
    role: UserRole = UserRole.consommateur
    status: UserStatus = UserStatus.active
    id_organization: Optional[int] = None


class UserUpdate(BaseModel):
    firstname: Optional[str] = None
    surname: Optional[str] = None
    email: Optional[EmailStr] = None
    password: Optional[str] = Field(None, min_length=8)
    phone_number: Optional[str] = None
    role: Optional[UserRole] = None
    status: Optional[UserStatus] = None
    id_organization: Optional[int] = None
