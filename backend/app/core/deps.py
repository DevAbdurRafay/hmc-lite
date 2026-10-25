from typing import List, Optional
from fastapi import Depends, HTTPException, status, Request
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.orm import Session
from slowapi import Limiter
from slowapi.util import get_remote_address

from app.core.config import settings
from app.core.database import get_db
from app.core.security import decode_token
from app.models import User, Employee

security_scheme = HTTPBearer(auto_error=False)
limiter = Limiter(key_func=get_remote_address)


def get_current_user(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security_scheme),
    db: Session = Depends(get_db)
) -> User:
    if not credentials:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail={"code": "UNAUTHORIZED", "message": "Missing authentication token", "details": None},
            headers={"WWW-Authenticate": "Bearer"},
        )
    token = credentials.credentials
    payload = decode_token(token)
    if not payload:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail={"code": "INVALID_TOKEN", "message": "Invalid or expired token", "details": None},
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    user_id = payload.get("sub")
    if not user_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail={"code": "INVALID_TOKEN", "message": "Token missing subject identifier", "details": None},
        )
    
    user = db.query(User).filter(User.id == int(user_id)).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail={"code": "USER_NOT_FOUND", "message": "User no longer exists", "details": None},
        )
    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail={"code": "ACCOUNT_DEACTIVATED", "message": "User account has been deactivated", "details": None},
        )
    token_version = payload.get("token_version")
    if token_version is not None and getattr(user, "token_version", None) is not None:
        if token_version != user.token_version:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail={"code": "TOKEN_REVOKED", "message": "Token has been revoked upon logout or password reset", "details": None},
                headers={"WWW-Authenticate": "Bearer"},
            )
    return user


def require_roles(allowed_roles: List[str]):
    def role_checker(current_user: User = Depends(get_current_user)) -> User:
        if current_user.role not in allowed_roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail={
                    "code": "FORBIDDEN",
                    "message": f"Operation not permitted for role '{current_user.role}'. Required: {allowed_roles}",
                    "details": None
                }
            )
        return current_user
    return role_checker


def enforce_employee_scope(current_user: User, target_employee_id: int) -> None:
    """
    Enforces server-side data scoping:
    - If user is EMPLOYEE, target_employee_id MUST match their own associated employee record.
    - If user is ADMIN or HR, full access is granted.
    """
    if current_user.role == "EMPLOYEE":
        if not current_user.employee or current_user.employee.id != target_employee_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail={
                    "code": "SCOPE_FORBIDDEN",
                    "message": "Access denied: Employees can only view and interact with their own records.",
                    "details": None
                }
            )
