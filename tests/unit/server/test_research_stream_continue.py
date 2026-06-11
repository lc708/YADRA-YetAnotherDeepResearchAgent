# Copyright (c) 2025 YADRA

import pytest
from unittest.mock import AsyncMock, MagicMock

from langgraph.types import Command

from src.server.research_stream_api import (
    ActionType,
    ResearchStreamRequest,
    ResearchStreamService,
)


def _continue_request(**overrides):
    data = {
        "action": ActionType.CONTINUE,
        "message": "refined question",
        "thread_id": "thread-abc",
        "frontend_uuid": "uuid-1",
        "frontend_context_uuid": "ctx-1",
        "visitor_id": "visitor-1",
        "config": {},
        "context": {"interrupt_feedback": "accepted"},
    }
    data.update(overrides)
    return ResearchStreamRequest(**data)


@pytest.mark.asyncio
async def test_continue_research_stream_uses_command_resume_for_hitl():
    """HITL continue must resume LangGraph via Command, not a plain state dict."""
    session_repo = MagicMock()
    session = MagicMock(id=42, thread_id="thread-abc")
    session_repo.get_session_by_thread_id = AsyncMock(return_value=session)
    session_repo.create_execution_record = AsyncMock(
        return_value=MagicMock(execution_id="exec-1")
    )
    session_repo.get_session_config = AsyncMock(return_value=None)

    service = ResearchStreamService(session_repo)
    service._get_graph = AsyncMock(return_value=MagicMock())

    captured = {}

    async def capture_stream(graph, initial_state, thread_id, execution_id, request, execution_type="continue"):
        captured["initial_state"] = initial_state
        captured["execution_type"] = execution_type
        if False:
            yield {}

    service._process_langgraph_stream = capture_stream

    events = [event async for event in service.continue_research_stream(_continue_request())]

    assert events == []
    assert isinstance(captured["initial_state"], Command)
    assert captured["initial_state"].resume == "[accepted] refined question"
    assert captured["execution_type"] == "continue"


@pytest.mark.asyncio
async def test_continue_research_stream_hitl_feedback_without_message():
    session_repo = MagicMock()
    session = MagicMock(id=42, thread_id="thread-abc")
    session_repo.get_session_by_thread_id = AsyncMock(return_value=session)
    session_repo.create_execution_record = AsyncMock(
        return_value=MagicMock(execution_id="exec-1")
    )
    session_repo.get_session_config = AsyncMock(return_value=None)

    service = ResearchStreamService(session_repo)
    service._get_graph = AsyncMock(return_value=MagicMock())

    captured = {}

    async def capture_stream(graph, initial_state, thread_id, execution_id, request, execution_type="continue"):
        captured["initial_state"] = initial_state
        if False:
            yield {}

    service._process_langgraph_stream = capture_stream

    request = _continue_request(message="")
    async for _ in service.continue_research_stream(request):
        pass

    assert captured["initial_state"].resume == "[accepted]"


@pytest.mark.asyncio
async def test_continue_research_stream_without_hitl_uses_plain_state():
    session_repo = MagicMock()
    session = MagicMock(id=42, thread_id="thread-abc")
    session_repo.get_session_by_thread_id = AsyncMock(return_value=session)
    session_repo.create_execution_record = AsyncMock(
        return_value=MagicMock(execution_id="exec-1")
    )
    session_repo.get_session_config = AsyncMock(return_value=None)

    service = ResearchStreamService(session_repo)
    service._get_graph = AsyncMock(return_value=MagicMock())

    captured = {}

    async def capture_stream(graph, initial_state, thread_id, execution_id, request, execution_type="continue"):
        captured["initial_state"] = initial_state
        if False:
            yield {}

    service._process_langgraph_stream = capture_stream

    request = _continue_request(context=None)
    async for _ in service.continue_research_stream(request):
        pass

    assert not isinstance(captured["initial_state"], Command)
    assert captured["initial_state"]["messages"] == [
        {"role": "user", "content": "refined question"}
    ]
