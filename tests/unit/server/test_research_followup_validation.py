# Copyright (c) 2025 YADRA

import pytest
from unittest.mock import AsyncMock, MagicMock

from fastapi import HTTPException

from src.server.research_create_api import ResearchAskRequest, ResearchAskService


def _followup_request(**overrides):
    data = {
        "question": "follow up question",
        "ask_type": "followup",
        "frontend_uuid": "uuid-1",
        "visitor_id": "visitor-1",
        "session_id": 1,
        "thread_id": "thread-1",
        "url_param": "test-slug",
    }
    data.update(overrides)
    return ResearchAskRequest(**data)


@pytest.mark.asyncio
async def test_prepare_followup_session_rejects_missing_params():
    service = ResearchAskService(session_repo=MagicMock())
    request = _followup_request(session_id=None)

    with pytest.raises(HTTPException) as exc:
        await service._prepare_followup_session(request)

    assert exc.value.status_code == 400
    assert "session_id, thread_id, url_param" in exc.value.detail


@pytest.mark.asyncio
async def test_prepare_followup_session_rejects_unknown_session():
    session_repo = MagicMock()
    session_repo.get_session_overview = AsyncMock(return_value=None)
    service = ResearchAskService(session_repo=session_repo)

    with pytest.raises(HTTPException) as exc:
        await service._prepare_followup_session(_followup_request())

    assert exc.value.status_code == 404
    assert exc.value.detail == "会话不存在"


@pytest.mark.asyncio
async def test_prepare_followup_session_rejects_session_id_mismatch():
    session_repo = MagicMock()
    session_repo.get_session_overview = AsyncMock(
        return_value={"id": 99, "thread_id": "thread-1"}
    )
    service = ResearchAskService(session_repo=session_repo)

    with pytest.raises(HTTPException) as exc:
        await service._prepare_followup_session(_followup_request(session_id=1))

    assert exc.value.status_code == 400
    assert exc.value.detail == "session_id不匹配"


@pytest.mark.asyncio
async def test_prepare_followup_session_rejects_thread_id_mismatch():
    session_repo = MagicMock()
    session_repo.get_session_overview = AsyncMock(
        return_value={"id": 1, "thread_id": "other-thread"}
    )
    service = ResearchAskService(session_repo=session_repo)

    with pytest.raises(HTTPException) as exc:
        await service._prepare_followup_session(_followup_request())

    assert exc.value.status_code == 400
    assert exc.value.detail == "thread_id不匹配"


@pytest.mark.asyncio
async def test_prepare_followup_session_rejects_missing_session_data():
    session_repo = MagicMock()
    session_repo.get_session_overview = AsyncMock(
        return_value={"id": 1, "thread_id": "thread-1"}
    )
    session_repo.get_session_by_thread_id = AsyncMock(return_value=None)
    service = ResearchAskService(session_repo=session_repo)

    with pytest.raises(HTTPException) as exc:
        await service._prepare_followup_session(_followup_request())

    assert exc.value.status_code == 404
    assert exc.value.detail == "Session数据不存在"


@pytest.mark.asyncio
async def test_prepare_followup_session_success():
    session_repo = MagicMock()
    session_repo.get_session_overview = AsyncMock(
        return_value={"id": 1, "thread_id": "thread-1"}
    )
    session_data = MagicMock(id=1)
    session_repo.get_session_by_thread_id = AsyncMock(return_value=session_data)
    service = ResearchAskService(session_repo=session_repo)

    data, thread_id, url_param = await service._prepare_followup_session(
        _followup_request()
    )

    assert data is session_data
    assert thread_id == "thread-1"
    assert url_param == "test-slug"
