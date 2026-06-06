# Copyright (c) 2025 YADRA

import pytest
from unittest.mock import AsyncMock, MagicMock
from fastapi import HTTPException

from src.server.research_create_api import ResearchAskRequest, ResearchAskService


def _followup_request(**overrides):
    data = {
        "question": "Tell me more",
        "ask_type": "followup",
        "frontend_uuid": "uuid-1",
        "visitor_id": "visitor-1",
        "session_id": 1,
        "thread_id": "thread-1",
        "url_param": "valid-slug-abc12345",
    }
    data.update(overrides)
    return ResearchAskRequest(**data)


@pytest.mark.asyncio
async def test_followup_ask_rejects_missing_required_fields():
    service = ResearchAskService(session_repo=MagicMock())
    request = _followup_request(session_id=None, thread_id=None, url_param=None)

    with pytest.raises(HTTPException) as exc:
        await service._handle_followup_ask(request)

    assert exc.value.status_code == 400
    assert "session_id, thread_id, url_param" in exc.value.detail


@pytest.mark.asyncio
async def test_followup_ask_rejects_unknown_session():
    repo = MagicMock()
    repo.get_session_overview = AsyncMock(return_value=None)
    service = ResearchAskService(session_repo=repo)

    with pytest.raises(HTTPException) as exc:
        await service._handle_followup_ask(_followup_request())

    assert exc.value.status_code == 404
    assert exc.value.detail == "会话不存在"


@pytest.mark.asyncio
async def test_followup_ask_rejects_session_id_mismatch():
    repo = MagicMock()
    repo.get_session_overview = AsyncMock(
        return_value={"id": 99, "thread_id": "thread-1"}
    )
    service = ResearchAskService(session_repo=repo)

    with pytest.raises(HTTPException) as exc:
        await service._handle_followup_ask(_followup_request(session_id=1))

    assert exc.value.status_code == 400
    assert exc.value.detail == "session_id不匹配"


@pytest.mark.asyncio
async def test_followup_ask_rejects_thread_id_mismatch():
    repo = MagicMock()
    repo.get_session_overview = AsyncMock(
        return_value={"id": 1, "thread_id": "other-thread"}
    )
    service = ResearchAskService(session_repo=repo)

    with pytest.raises(HTTPException) as exc:
        await service._handle_followup_ask(_followup_request(thread_id="thread-1"))

    assert exc.value.status_code == 400
    assert exc.value.detail == "thread_id不匹配"
