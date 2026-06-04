"""Session ownership checks for authenticated API routes."""

from typing import Any, Mapping, Optional

from fastapi import HTTPException


def _session_owner_id(session: Any) -> Optional[str]:
    if isinstance(session, Mapping):
        return session.get("user_id")
    return getattr(session, "user_id", None)


def assert_session_owner(session: Any, user_id: str) -> None:
    """
    Ensure the authenticated user may access this session.

    Sessions without a stored user_id are treated as legacy/anonymous and are not
    blocked here (call sites may apply additional checks later).
    """
    owner_id = _session_owner_id(session)
    if owner_id is not None and owner_id != user_id:
        raise HTTPException(status_code=403, detail="无权访问此会话")
