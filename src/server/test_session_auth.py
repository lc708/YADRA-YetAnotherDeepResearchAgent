"""Unit tests for session ownership checks."""

import pytest
from fastapi import HTTPException

from src.server.repositories.session_repository import SessionMapping
from src.server.session_auth import assert_session_owner


def test_assert_session_owner_allows_matching_user():
    session = SessionMapping(user_id="user-a")
    assert_session_owner(session, "user-a")


def test_assert_session_owner_allows_legacy_anonymous_session():
    session = SessionMapping(user_id=None)
    assert_session_owner(session, "user-a")


def test_assert_session_owner_denies_other_user():
    session = SessionMapping(user_id="owner")
    with pytest.raises(HTTPException) as exc_info:
        assert_session_owner(session, "attacker")
    assert exc_info.value.status_code == 403


def test_assert_session_owner_works_with_mapping():
    with pytest.raises(HTTPException):
        assert_session_owner({"user_id": "owner"}, "attacker")
