"""Tests for session ownership verification."""

import importlib.util
from pathlib import Path
from types import SimpleNamespace

import pytest

_spec = importlib.util.spec_from_file_location(
    "session_access",
    Path(__file__).resolve().parents[1] / "src/server/session_access.py",
)
_mod = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(_mod)
SessionAccessDenied = _mod.SessionAccessDenied
verify_session_access = _mod.verify_session_access


def test_allows_matching_user_id():
    verify_session_access({"user_id": "user-1"}, user_id="user-1")


def test_denies_different_user_id():
    with pytest.raises(SessionAccessDenied):
        verify_session_access({"user_id": "user-1"}, user_id="user-2")


def test_allows_legacy_visitor_session():
    verify_session_access(
        {"user_id": None, "visitor_id": "visitor-abc"},
        user_id="any-user",
        visitor_id="visitor-abc",
    )


def test_denies_visitor_mismatch():
    with pytest.raises(SessionAccessDenied):
        verify_session_access(
            {"user_id": None, "visitor_id": "visitor-abc"},
            user_id="any-user",
            visitor_id="visitor-xyz",
        )


def test_works_with_object_attributes():
    session = SimpleNamespace(user_id="user-42", visitor_id="v1")
    verify_session_access(session, user_id="user-42")


def test_denies_session_with_no_owner():
    with pytest.raises(SessionAccessDenied):
        verify_session_access({}, user_id="user-1")
