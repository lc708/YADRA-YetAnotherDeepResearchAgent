# Copyright (c) 2025 YADRA

import json
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from fastapi import HTTPException

from src.server.research_stream_api import (
    ActionType,
    ResearchStreamRequest,
    get_session_repository_dependency,
    research_stream,
)


@pytest.mark.asyncio
async def test_get_session_repository_dependency_requires_database_url(monkeypatch):
    monkeypatch.delenv("DATABASE_URL", raising=False)

    with pytest.raises(HTTPException) as exc:
        await get_session_repository_dependency()

    assert exc.value.status_code == 500
    assert "Database configuration error" in exc.value.detail


@pytest.mark.asyncio
async def test_get_session_repository_dependency_returns_repository(monkeypatch):
    monkeypatch.setenv("DATABASE_URL", "postgresql://user:pass@localhost/db")
    mock_repo = MagicMock()

    with patch(
        "src.server.research_stream_api.get_session_repository",
        return_value=mock_repo,
    ) as get_repo:
        repo = await get_session_repository_dependency()

    get_repo.assert_called_once_with("postgresql://user:pass@localhost/db")
    assert repo is mock_repo


def _stream_request(**overrides):
    data = {
        "action": ActionType.CREATE,
        "message": "topic",
        "frontend_uuid": "uuid-1",
        "frontend_context_uuid": "ctx-1",
        "visitor_id": "visitor-1",
        "config": {},
    }
    data.update(overrides)
    return ResearchStreamRequest(**data)


@pytest.mark.asyncio
async def test_research_stream_injects_authenticated_user_id():
    """Route must stamp user_id from auth before delegating to the service."""
    session_repo = MagicMock()
    request = _stream_request()
    current_user = {"user_id": "user-123"}
    captured = {}

    async def fake_create(req, existing_session_id=None, existing_thread_id=None):
        captured["user_id"] = req.user_id
        if False:
            yield {}

    mock_service = MagicMock()
    mock_service.create_research_stream = fake_create

    with patch(
        "src.server.research_stream_api.ResearchStreamService",
        return_value=mock_service,
    ):
        response = await research_stream(
            request,
            current_user=current_user,
            session_repo=session_repo,
        )
        async for _ in response.body_iterator:
            pass

    assert captured["user_id"] == "user-123"
    assert response.media_type == "text/event-stream"


@pytest.mark.asyncio
async def test_research_stream_routes_continue_action_to_continue_handler():
    session_repo = MagicMock()
    request = _stream_request(action=ActionType.CONTINUE, thread_id="thread-1")
    current_user = {"user_id": "user-456"}
    captured = {}

    async def fake_continue(req):
        captured["action"] = req.action
        captured["thread_id"] = req.thread_id
        if False:
            yield {}

    mock_service = MagicMock()
    mock_service.continue_research_stream = fake_continue

    with patch(
        "src.server.research_stream_api.ResearchStreamService",
        return_value=mock_service,
    ):
        response = await research_stream(
            request,
            current_user=current_user,
            session_repo=session_repo,
        )
        async for _ in response.body_iterator:
            pass

    assert captured["action"] == ActionType.CONTINUE
    assert captured["thread_id"] == "thread-1"


@pytest.mark.asyncio
async def test_research_stream_formats_sse_events():
    session_repo = MagicMock()
    request = _stream_request()
    current_user = {"user_id": "user-789"}

    async def fake_create(req, existing_session_id=None, existing_thread_id=None):
        yield {"event": "metadata", "data": json.dumps({"thread_id": "t-1"})}
        yield {"event": "complete", "data": json.dumps({"status": "done"})}

    mock_service = MagicMock()
    mock_service.create_research_stream = fake_create

    with patch(
        "src.server.research_stream_api.ResearchStreamService",
        return_value=mock_service,
    ):
        response = await research_stream(
            request,
            current_user=current_user,
            session_repo=session_repo,
        )

    body = "".join([chunk async for chunk in response.body_iterator])

    assert "event: metadata\n" in body
    assert 'data: {"thread_id": "t-1"}\n\n' in body
    assert "event: complete\n" in body
    assert 'data: {"status": "done"}\n\n' in body
