"""Session ownership checks for authenticated API routes."""

from typing import Any, Mapping, Optional, Union

from fastapi import HTTPException

from src.server.repositories.session_repository import SessionMapping


def assert_session_owner(
    session: Union[SessionMapping, Mapping[str, Any]],
    user_id: str,
) -> None:
    """
    Ensure the authenticated user may access this session.

    Sessions without a stored user_id are treated as legacy/anonymous and are not
    blocked here (call sites may apply additional checks later).
    """
    owner_id: Optional[str]
    if isinstance(session, SessionMapping):
        owner_id = session.user_id
    else:
        owner_id = session.get("user_id")

    if owner_id is not None and owner_id != user_id:
        raise HTTPException(status_code=403, detail="无权访问此会话")
