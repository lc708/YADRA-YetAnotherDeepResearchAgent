# Copyright (c) 2025 YADRA

"""Regression tests for legacy /api/chat/stream route in app.py."""

import json
from unittest.mock import AsyncMock, MagicMock, patch
from uuid import UUID

import pytest
from fastapi import HTTPException

from src.server.app import _make_event, chat_stream
from src.server.chat_request import ChatRequest


def _chat_request(**overrides):
    data = {
        "messages": [{"role": "user", "content": "What is quantum computing?"}],
        "thread_id": "__default__",
    }
    data.update(overrides)
    return ChatRequest(**data)


def _parse_sse(event_str: str) -> tuple[str, dict]:
    lines = event_str.strip().split("\n")
    event_type = lines[0].split(": ", 1)[1]
    data = json.loads(lines[1].split(": ", 1)[1])
    return event_type, data


async def _collect_sse(response) -> list[str]:
    chunks = []
    async for chunk in response.body_iterator:
        chunks.append(chunk.decode() if isinstance(chunk, bytes) else chunk)
    return chunks


async def _fake_workflow_generator(*args, **kwargs):
    thread_id = kwargs.get("thread_id", args[2] if len(args) > 2 else "unknown")
    yield _make_event("done", {"thread_id": thread_id, "status": "completed"})


@pytest.mark.asyncio
async def test_chat_stream_generates_thread_id_for_default_placeholder():
    """Anonymous chat must allocate a backend thread_id when client sends __default__."""
    fixed_id = UUID("00000000-0000-0000-0000-000000000001")

    with (
        patch("src.server.app.uuid4", return_value=fixed_id),
        patch(
            "src.server.app.get_graph_instance",
            AsyncMock(return_value=MagicMock()),
        ),
        patch(
            "src.server.app._astream_workflow_generator",
            _fake_workflow_generator,
        ),
    ):
        response = await chat_stream(_chat_request(), authorization=None)
        events = await _collect_sse(response)

    event_type, data = _parse_sse(events[0])
    assert event_type == "thread_created"
    assert data["thread_id"] == str(fixed_id)


@pytest.mark.asyncio
async def test_chat_stream_preserves_explicit_thread_id():
    with (
        patch(
            "src.server.app.get_graph_instance",
            AsyncMock(return_value=MagicMock()),
        ),
        patch(
            "src.server.app._astream_workflow_generator",
            _fake_workflow_generator,
        ),
    ):
        response = await chat_stream(
            _chat_request(thread_id="existing-thread"),
            authorization=None,
        )
        events = await _collect_sse(response)

    event_type, data = _parse_sse(events[0])
    assert event_type == "thread_created"
    assert data["thread_id"] == "existing-thread"


@pytest.mark.asyncio
async def test_chat_stream_creates_task_for_authenticated_user():
    mock_create_task = AsyncMock()

    with (
        patch(
            "src.server.app.get_graph_instance",
            AsyncMock(return_value=MagicMock()),
        ),
        patch(
            "src.server.app._astream_workflow_generator",
            _fake_workflow_generator,
        ),
        patch("src.server.app.get_current_user", AsyncMock(return_value={"user_id": "user-42"})),
        patch("src.server.app.create_or_update_task", mock_create_task),
    ):
        response = await chat_stream(
            _chat_request(thread_id="thread-auth"),
            authorization="Bearer valid-token",
        )
        await _collect_sse(response)

    mock_create_task.assert_awaited_once_with("user-42", "thread-auth")


@pytest.mark.asyncio
async def test_chat_stream_allows_anonymous_access_when_auth_fails():
    """Optional auth: invalid bearer must not block the stream for anonymous users."""
    mock_create_task = AsyncMock()

    with (
        patch(
            "src.server.app.get_graph_instance",
            AsyncMock(return_value=MagicMock()),
        ),
        patch(
            "src.server.app._astream_workflow_generator",
            _fake_workflow_generator,
        ),
        patch(
            "src.server.app.get_current_user",
            AsyncMock(side_effect=HTTPException(status_code=401, detail="bad token")),
        ),
        patch("src.server.app.create_or_update_task", mock_create_task),
    ):
        response = await chat_stream(
            _chat_request(thread_id="anon-thread"),
            authorization="Bearer expired-token",
        )
        events = await _collect_sse(response)

    mock_create_task.assert_not_called()
    event_type, data = _parse_sse(events[0])
    assert event_type == "thread_created"
    assert data["thread_id"] == "anon-thread"


@pytest.mark.asyncio
async def test_chat_stream_passes_user_id_to_workflow_generator():
    captured = {}

    async def capture_workflow(*args, **kwargs):
        captured["user_id"] = kwargs.get("user_id")
        async for event in _fake_workflow_generator(*args, **kwargs):
            yield event

    with (
        patch(
            "src.server.app.get_graph_instance",
            AsyncMock(return_value=MagicMock()),
        ),
        patch("src.server.app._astream_workflow_generator", capture_workflow),
        patch(
            "src.server.app.get_current_user",
            AsyncMock(return_value={"user_id": "user-stream"}),
        ),
        patch("src.server.app.create_or_update_task", AsyncMock()),
    ):
        response = await chat_stream(
            _chat_request(thread_id="thread-user"),
            authorization="Bearer valid-token",
        )
        await _collect_sse(response)

    assert captured["user_id"] == "user-stream"
