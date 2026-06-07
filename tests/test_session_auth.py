"""Tests for session ownership authorization."""

import os

os.environ.setdefault("NEXT_PUBLIC_SUPABASE_URL", "https://example.supabase.co")
os.environ.setdefault("NEXT_PUBLIC_SUPABASE_ANON_KEY", "test-anon-key")

import pytest
from fastapi import HTTPException

from src.server.repositories.session_repository import SessionMapping
from src.server.session_auth import assert_session_owner


def test_assert_session_owner_allows_matching_user_mapping():
    session = SessionMapping(user_id="user-a")
    assert_session_owner(session, "user-a")


def test_assert_session_owner_allows_matching_user_dict():
    session = {"user_id": "user-a", "thread_id": "t1"}
    assert_session_owner(session, "user-a")


def test_assert_session_owner_allows_legacy_anonymous_session():
    session = SessionMapping(user_id=None)
    assert_session_owner(session, "user-a")


def test_assert_session_owner_rejects_other_user():
    session = {"user_id": "user-a", "thread_id": "t1"}
    with pytest.raises(HTTPException) as exc_info:
        assert_session_owner(session, "user-b")
    assert exc_info.value.status_code == 403
