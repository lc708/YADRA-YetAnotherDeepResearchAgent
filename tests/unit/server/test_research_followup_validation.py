# Copyright (c) 2025 YADRA

"""Regression tests for followup session validation in ResearchAskService."""

import pytest
from unittest.mock import AsyncMock, MagicMock

from fastapi import HTTPException

from src.server.research_create_api import ResearchAskRequest, ResearchAskService
from src.server.repositories.session_repository import SessionMapping


def _followup_request(**overrides):
    data = {
        "question": "Follow-up question",
        "ask_type": "followup",
        "frontend_uuid": "uuid-1",
        "visitor_id": "visitor-1",
        "session_id": 42,
        "thread_id": "thread-abc",
        "url_param": "valid-slug-abc12345",
    }
    data.update(overrides)
    return ResearchAskRequest(**data)


def _service_with_repo(repo=None):
    return ResearchAskService(session_repo=repo or MagicMock())


@pytest.mark.asyncio
async def test_prepare_followup_rejects_missing_required_fields():
    service = _service_with_repo()
    request = _followup_request(session_id=None)

    with pytest.raises(HTTPException) as exc:
        await service._prepare_followup_session(request)

    assert exc.value.status_code == 400
    assert "session_id, thread_id, url_param" in exc.value.detail


@pytest.mark.asyncio
async def test_prepare_followup_rejects_unknown_session():
    repo = MagicMock()
    repo.get_session_overview = AsyncMock(return_value=None)
    service = _service_with_repo(repo)

    with pytest.raises(HTTPException) as exc:
        await service._prepare_followup_session(_followup_request())

    assert exc.value.status_code == 404
    assert exc.value.detail == "会话不存在"


@pytest.mark.asyncio
async def test_prepare_followup_rejects_session_id_mismatch():
    repo = MagicMock()
    repo.get_session_overview = AsyncMock(
        return_value={"id": 99, "thread_id": "thread-abc"}
    )
    service = _service_with_repo(repo)

    with pytest.raises(HTTPException) as exc:
        await service._prepare_followup_session(_followup_request(session_id=42))

    assert exc.value.status_code == 400
    assert exc.value.detail == "session_id不匹配"


@pytest.mark.asyncio
async def test_prepare_followup_rejects_thread_id_mismatch():
    repo = MagicMock()
    repo.get_session_overview = AsyncMock(
        return_value={"id": 42, "thread_id": "other-thread"}
    )
    service = _service_with_repo(repo)

    with pytest.raises(HTTPException) as exc:
        await service._prepare_followup_session(_followup_request())

    assert exc.value.status_code == 400
    assert exc.value.detail == "thread_id不匹配"


@pytest.mark.asyncio
async def test_prepare_followup_rejects_missing_session_data():
    repo = MagicMock()
    repo.get_session_overview = AsyncMock(
        return_value={"id": 42, "thread_id": "thread-abc"}
    )
    repo.get_session_by_thread_id = AsyncMock(return_value=None)
    service = _service_with_repo(repo)

    with pytest.raises(HTTPException) as exc:
        await service._prepare_followup_session(_followup_request())

    assert exc.value.status_code == 404
    assert exc.value.detail == "Session数据不存在"


@pytest.mark.asyncio
async def test_prepare_followup_returns_session_on_valid_request():
    session_data = SessionMapping(id=42, thread_id="thread-abc", url_param="valid-slug-abc12345")
    repo = MagicMock()
    repo.get_session_overview = AsyncMock(
        return_value={"id": 42, "thread_id": "thread-abc"}
    )
    repo.get_session_by_thread_id = AsyncMock(return_value=session_data)
    service = _service_with_repo(repo)

    result_session, thread_id, url_param = await service._prepare_followup_session(
        _followup_request()
    )

    assert result_session is session_data
    assert thread_id == "thread-abc"
    assert url_param == "valid-slug-abc12345"


@pytest.mark.asyncio
async def test_handle_followup_ask_rejects_session_id_mismatch():
    repo = MagicMock()
    repo.get_session_overview = AsyncMock(
        return_value={"id": 99, "thread_id": "thread-abc"}
    )
    service = _service_with_repo(repo)

    with pytest.raises(HTTPException) as exc:
        await service._handle_followup_ask(_followup_request())

    assert exc.value.status_code == 400
    assert exc.value.detail == "session_id不匹配"
