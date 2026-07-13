# Copyright (c) 2025 YADRA

"""Regression tests for Supabase auth header validation."""

from unittest.mock import MagicMock, patch

import pytest
from fastapi import HTTPException

from src.server.supabase_auth_api import get_current_user


@pytest.mark.asyncio
async def test_get_current_user_requires_bearer_prefix():
    with pytest.raises(HTTPException) as exc:
        await get_current_user(authorization=None)

    assert exc.value.status_code == 401
    assert exc.value.detail == "Authentication required"


@pytest.mark.asyncio
async def test_get_current_user_rejects_malformed_authorization_header():
    with pytest.raises(HTTPException) as exc:
        await get_current_user(authorization="Token abc123")

    assert exc.value.status_code == 401
    assert exc.value.detail == "Authentication required"


@pytest.mark.asyncio
async def test_get_current_user_rejects_invalid_supabase_token():
    mock_supabase = MagicMock()
    mock_supabase.auth.get_user.return_value = MagicMock(user=None)

    with patch(
        "src.server.supabase_auth_api.get_supabase_client",
        return_value=mock_supabase,
    ):
        with pytest.raises(HTTPException) as exc:
            await get_current_user(authorization="Bearer invalid-token")

    assert exc.value.status_code == 401
    assert exc.value.detail == "Authentication failed"
    mock_supabase.auth.get_user.assert_called_once_with("invalid-token")


@pytest.mark.asyncio
async def test_get_current_user_returns_user_context_on_valid_token():
    mock_user = MagicMock()
    mock_user.id = "user-abc"
    mock_user.email = "user@example.com"
    mock_supabase = MagicMock()
    mock_supabase.auth.get_user.return_value = MagicMock(user=mock_user)

    with patch(
        "src.server.supabase_auth_api.get_supabase_client",
        return_value=mock_supabase,
    ):
        result = await get_current_user(authorization="Bearer good-token")

    assert result == {
        "user_id": "user-abc",
        "email": "user@example.com",
        "user": mock_user,
    }
