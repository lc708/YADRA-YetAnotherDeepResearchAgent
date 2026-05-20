"""Session ownership checks shared by research APIs."""

from typing import Any, Dict, Optional


class SessionAccessDenied(PermissionError):
    """Raised when a caller is not allowed to access a session."""


def verify_session_access(
    session: Dict[str, Any],
    *,
    user_id: str,
    visitor_id: Optional[str] = None,
) -> None:
    """
    Ensure the authenticated user (or matching visitor for legacy sessions) may access the session.

    Raises:
        SessionAccessDenied: if access should be denied.
    """
    owner_id = session.get("user_id")
    if owner_id is not None:
        if str(owner_id) != str(user_id):
            raise SessionAccessDenied("Session belongs to another user")
        return

    session_visitor = session.get("visitor_id")
    if session_visitor is not None:
        if not visitor_id or str(session_visitor) != str(visitor_id):
            raise SessionAccessDenied("Visitor does not match session")
        return

    raise SessionAccessDenied("Session has no accessible owner")
