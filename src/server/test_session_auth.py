"""Unit tests for session ownership checks."""

import pytest
from fastapi import HTTPException

from src.server.repositories.session_repository import SessionMapping
from src.server.session_auth import assert_session_owner


def test_allows_owner():
    session = SessionMapping(user_id="user-1")
    assert_session_owner(session, "user-1")


def test_allows_legacy_anonymous_session():
    session = SessionMapping(user_id=None)
    assert_session_owner(session, "user-1")


def test_blocks_non_owner():
    session = SessionMapping(user_id="user-1")
    with pytest.raises(HTTPException) as exc_info:
        assert_session_owner(session, "user-2")
    assert exc_info.value.status_code == 403


def test_blocks_non_owner_dict_session():
    session = {"user_id": "user-1", "id": 42}
    with pytest.raises(HTTPException) as exc_info:
        assert_session_owner(session, "user-2")
    assert exc_info.value.status_code == 403
