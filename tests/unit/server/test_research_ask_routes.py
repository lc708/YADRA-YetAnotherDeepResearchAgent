# Copyright (c) 2025 YADRA

import asyncio
import json
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from fastapi import HTTPException
from starlette.requests import Request

from src.server.research_create_api import (
    ResearchAskRequest,
    ResearchAskResponse,
    ResearchAskService,
    ask_research,
    get_research_ask_service,
    get_session_repository_dependency,
)


def _initial_payload(**overrides):
    data = {
        "question": "What is quantum computing?",
        "ask_type": "initial",
        "frontend_uuid": "uuid-1",
        "visitor_id": "visitor-1",
        "config": {},
    }
    data.update(overrides)
    return ResearchAskRequest(**data)


def _http_request(*, disconnected: bool = False):
    scope = {
        "type": "http",
        "method": "POST",
        "path": "/api/research/ask",
        "headers": [],
    }
    request = Request(scope)

    async def fake_is_disconnected():
        return disconnected

    request.is_disconnected = fake_is_disconnected
    return request


@pytest.mark.asyncio
async def test_get_session_repository_dependency_requires_database_url(monkeypatch):
    monkeypatch.delenv("DATABASE_URL", raising=False)

    with pytest.raises(HTTPException) as exc:
        await get_session_repository_dependency()

    assert exc.value.status_code == 500
    assert "数据库配置错误" in exc.value.detail


@pytest.mark.asyncio
async def test_get_session_repository_dependency_returns_repository(monkeypatch):
    monkeypatch.setenv("DATABASE_URL", "postgresql://user:pass@localhost/db")
    mock_repo = MagicMock()

    with patch(
        "src.server.research_create_api.get_session_repository",
        return_value=mock_repo,
    ) as get_repo:
        repo = await get_session_repository_dependency()

    get_repo.assert_called_once_with("postgresql://user:pass@localhost/db")
    assert repo is mock_repo


@pytest.mark.asyncio
async def test_ask_research_injects_authenticated_user_id():
    """Route must stamp user_id from auth before delegating to the service."""
    payload = _initial_payload()
    current_user = {"user_id": "user-123"}
    mock_response = ResearchAskResponse(
        ask_type="initial",
        url_param="slug-1",
        frontend_uuid="uuid-1",
        session_id=1,
        thread_id="thread-1",
        workspace_url="/workspace?id=slug-1",
        created_at="2026-07-04T00:00:00",
    )
    mock_service = MagicMock()
    mock_service.ask_research = AsyncMock(return_value=mock_response)

    result = await ask_research(
        payload=payload,
        http_request=_http_request(),
        stream=False,
        current_user=current_user,
        service=mock_service,
    )

    assert payload.user_id == "user-123"
    assert result is mock_response
    mock_service.ask_research.assert_called_once_with(payload, stream=False)


@pytest.mark.asyncio
async def test_ask_research_non_stream_returns_json_response():
    payload = _initial_payload()
    mock_response = ResearchAskResponse(
        ask_type="initial",
        url_param="slug-1",
        frontend_uuid="uuid-1",
        session_id=1,
        thread_id="thread-1",
        workspace_url="/workspace?id=slug-1",
        created_at="2026-07-04T00:00:00",
    )
    mock_service = MagicMock()
    mock_service.ask_research = AsyncMock(return_value=mock_response)

    result = await ask_research(
        payload=payload,
        http_request=_http_request(),
        stream=False,
        current_user={"user_id": "user-1"},
        service=mock_service,
    )

    assert result.url_param == "slug-1"
    assert result.workspace_url == "/workspace?id=slug-1"


@pytest.mark.asyncio
async def test_ask_research_stream_mode_returns_sse_response():
    payload = _initial_payload()

    async def fake_stream(_request):
        yield 'event: navigation\ndata: {"workspace_url": "/workspace?id=slug-1"}\n\n'

    mock_service = MagicMock()
    mock_service.ask_research = MagicMock(return_value=fake_stream(payload))

    response = await ask_research(
        payload=payload,
        http_request=_http_request(),
        stream=True,
        current_user={"user_id": "user-1"},
        service=mock_service,
    )

    body = "".join([chunk async for chunk in response.body_iterator])
    assert response.media_type == "text/event-stream"
    assert "event: navigation" in body
    assert "workspace_url" in body
    assert response.headers["X-Accel-Buffering"] == "no"


@pytest.mark.asyncio
async def test_ask_research_stream_stops_when_client_disconnects():
    payload = _initial_payload()

    async def long_stream(_request):
        yield "event: navigation\ndata: {}\n\n"
        yield "event: metadata\ndata: {}\n\n"
        yield "event: complete\ndata: {}\n\n"

    mock_service = MagicMock()
    mock_service.ask_research = MagicMock(return_value=long_stream(payload))

    scope = {
        "type": "http",
        "method": "POST",
        "path": "/api/research/ask",
        "headers": [],
    }
    request = Request(scope)
    disconnect_checks = {"count": 0}

    async def fake_is_disconnected():
        disconnect_checks["count"] += 1
        return disconnect_checks["count"] > 1

    request.is_disconnected = fake_is_disconnected

    response = await ask_research(
        payload=payload,
        http_request=request,
        stream=True,
        current_user={"user_id": "user-1"},
        service=mock_service,
    )

    body = "".join([chunk async for chunk in response.body_iterator])
    assert "event: navigation" in body
    assert "event: metadata" not in body


@pytest.mark.asyncio
async def test_ask_research_stream_emits_error_event_on_emitter_failure():
    payload = _initial_payload()

    async def failing_stream(_request):
        yield "event: navigation\ndata: {}\n\n"
        raise RuntimeError("stream generator exploded")

    mock_service = MagicMock()
    mock_service.ask_research = MagicMock(return_value=failing_stream(payload))

    response = await ask_research(
        payload=payload,
        http_request=_http_request(),
        stream=True,
        current_user={"user_id": "user-1"},
        service=mock_service,
    )

    body = "".join([chunk async for chunk in response.body_iterator])
    assert "event: error" in body
    error_payload = None
    for line in body.splitlines():
        if line.startswith("data: ") and "STREAM_EMITTER_ERROR" in line:
            error_payload = json.loads(line.split("data: ", 1)[1].strip())
            break
    assert error_payload is not None
    assert error_payload["error_code"] == "STREAM_EMITTER_ERROR"
    assert "stream generator exploded" in error_payload["error_message"]


@pytest.mark.asyncio
async def test_ask_research_reraises_http_exceptions():
    payload = _initial_payload()
    mock_service = MagicMock()
    mock_service.ask_research = AsyncMock(side_effect=HTTPException(status_code=404, detail="not found"))

    with pytest.raises(HTTPException) as exc:
        await ask_research(
            payload=payload,
            http_request=_http_request(),
            stream=False,
            current_user={"user_id": "user-1"},
            service=mock_service,
        )

    assert exc.value.status_code == 404


@pytest.mark.asyncio
async def test_get_research_ask_service_returns_bound_service_instance():
    mock_repo = MagicMock()
    service = await get_research_ask_service(session_repo=mock_repo)

    assert isinstance(service, ResearchAskService)
    assert service.session_repo is mock_repo


@pytest.mark.asyncio
async def test_ask_research_stream_emits_sse_heartbeat_keepalive(monkeypatch):
    """SSE route must emit comment heartbeats to keep proxies from closing idle streams."""
    payload = _initial_payload()

    async def fake_stream(_request):
        yield "event: navigation\ndata: {}\n\n"
        yield "event: chunk\ndata: {}\n\n"

    mock_service = MagicMock()
    mock_service.ask_research = MagicMock(return_value=fake_stream(payload))

    times = iter([0.0, 35.0])
    loop = asyncio.get_event_loop()
    monkeypatch.setattr(loop, "time", lambda: next(times, 35.0))

    response = await ask_research(
        payload=payload,
        http_request=_http_request(),
        stream=True,
        current_user={"user_id": "user-1"},
        service=mock_service,
    )

    body = "".join([chunk async for chunk in response.body_iterator])
    assert ": heartbeat" in body


@pytest.mark.asyncio
async def test_ask_research_wraps_unexpected_errors_as_500():
    payload = _initial_payload()
    mock_service = MagicMock()
    mock_service.ask_research = AsyncMock(side_effect=RuntimeError("boom"))

    with pytest.raises(HTTPException) as exc:
        await ask_research(
            payload=payload,
            http_request=_http_request(),
            stream=False,
            current_user={"user_id": "user-1"},
            service=mock_service,
        )

    assert exc.value.status_code == 500
    assert exc.value.detail == "Internal server error"
