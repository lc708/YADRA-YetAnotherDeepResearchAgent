# Copyright (c) 2025 YADRA

import pytest
from unittest.mock import AsyncMock, MagicMock, patch

from fastapi import HTTPException

from src.server.research_create_api import ResearchAskRequest, ResearchAskService


def _followup_request(**overrides):
    data = {
        "question": "Follow up on quantum computing",
        "ask_type": "followup",
        "frontend_uuid": "uuid-1",
        "visitor_id": "visitor-1",
        "session_id": 42,
        "thread_id": "thread-abc",
        "url_param": "quantum-computing-abc12345",
    }
    data.update(overrides)
    return ResearchAskRequest(**data)


def _service(session_repo=None):
    return ResearchAskService(session_repo=session_repo or MagicMock())


@pytest.mark.asyncio
async def test_prepare_followup_session_rejects_missing_params():
    service = _service()
    request = _followup_request(session_id=None)

    with pytest.raises(HTTPException) as exc:
        await service._prepare_followup_session(request)

    assert exc.value.status_code == 400
    assert "session_id, thread_id, url_param" in exc.value.detail


@pytest.mark.asyncio
async def test_prepare_followup_session_rejects_unknown_session():
    session_repo = MagicMock()
    session_repo.get_session_overview = AsyncMock(return_value=None)
    service = _service(session_repo)

    with pytest.raises(HTTPException) as exc:
        await service._prepare_followup_session(_followup_request())

    assert exc.value.status_code == 404
    assert exc.value.detail == "会话不存在"


@pytest.mark.asyncio
async def test_prepare_followup_session_rejects_session_id_mismatch():
    session_repo = MagicMock()
    session_repo.get_session_overview = AsyncMock(
        return_value={"id": 99, "thread_id": "thread-abc"}
    )
    service = _service(session_repo)

    with pytest.raises(HTTPException) as exc:
        await service._prepare_followup_session(_followup_request(session_id=42))

    assert exc.value.status_code == 400
    assert exc.value.detail == "session_id不匹配"


@pytest.mark.asyncio
async def test_prepare_followup_session_rejects_thread_id_mismatch():
    session_repo = MagicMock()
    session_repo.get_session_overview = AsyncMock(
        return_value={"id": 42, "thread_id": "other-thread"}
    )
    service = _service(session_repo)

    with pytest.raises(HTTPException) as exc:
        await service._prepare_followup_session(_followup_request())

    assert exc.value.status_code == 400
    assert exc.value.detail == "thread_id不匹配"


@pytest.mark.asyncio
async def test_prepare_followup_session_rejects_missing_session_data():
    session_repo = MagicMock()
    session_repo.get_session_overview = AsyncMock(
        return_value={"id": 42, "thread_id": "thread-abc"}
    )
    session_repo.get_session_by_thread_id = AsyncMock(return_value=None)
    service = _service(session_repo)

    with pytest.raises(HTTPException) as exc:
        await service._prepare_followup_session(_followup_request())

    assert exc.value.status_code == 404
    assert exc.value.detail == "Session数据不存在"


@pytest.mark.asyncio
async def test_prepare_followup_session_returns_session_on_success():
    session_data = MagicMock(id=42, thread_id="thread-abc")
    session_repo = MagicMock()
    session_repo.get_session_overview = AsyncMock(
        return_value={"id": 42, "thread_id": "thread-abc"}
    )
    session_repo.get_session_by_thread_id = AsyncMock(return_value=session_data)
    service = _service(session_repo)

    result_session, thread_id, url_param = await service._prepare_followup_session(
        _followup_request()
    )

    assert result_session is session_data
    assert thread_id == "thread-abc"
    assert url_param == "quantum-computing-abc12345"


@pytest.mark.asyncio
async def test_handle_followup_ask_rejects_missing_params():
    service = _service()

    with pytest.raises(HTTPException) as exc:
        await service._handle_followup_ask(_followup_request(url_param=None))

    assert exc.value.status_code == 400
    assert "session_id, thread_id, url_param" in exc.value.detail


@pytest.mark.asyncio
async def test_handle_followup_ask_rejects_session_id_mismatch():
    session_repo = MagicMock()
    session_repo.get_session_overview = AsyncMock(
        return_value={"id": 99, "thread_id": "thread-abc"}
    )
    service = _service(session_repo)

    with pytest.raises(HTTPException) as exc:
        await service._handle_followup_ask(_followup_request())

    assert exc.value.status_code == 400
    assert exc.value.detail == "session_id不匹配"


@pytest.mark.asyncio
async def test_handle_followup_ask_starts_task_and_returns_existing_session():
    session_repo = MagicMock()
    session_repo.get_session_overview = AsyncMock(
        return_value={"id": 42, "thread_id": "thread-abc"}
    )
    service = _service(session_repo)

    with patch("src.server.research_create_api.asyncio.create_task") as mock_create_task:
        mock_create_task.side_effect = lambda coro: coro.close()
        response = await service._handle_followup_ask(_followup_request())

    mock_create_task.assert_called_once()
    assert response.ask_type == "followup"
    assert response.session_id == 42
    assert response.thread_id == "thread-abc"
    assert response.url_param == "quantum-computing-abc12345"
    assert response.workspace_url == "/workspace?id=quantum-computing-abc12345"
