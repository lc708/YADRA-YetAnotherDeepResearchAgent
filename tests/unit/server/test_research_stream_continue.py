# Copyright (c) 2025 YADRA

import json

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


@pytest.mark.asyncio
async def test_continue_research_stream_merges_saved_session_config():
    """Continue must load persisted session config instead of empty request.config."""
    session_repo = MagicMock()
    session = MagicMock(id=42, thread_id="thread-abc")
    session_repo.get_session_by_thread_id = AsyncMock(return_value=session)
    session_repo.create_execution_record = AsyncMock(
        return_value=MagicMock(execution_id="exec-1")
    )
    saved_config = MagicMock(
        research_config={
            "auto_accepted_plan": True,
            "enable_background_investigation": False,
            "report_style": "news",
            "enable_deep_thinking": True,
            "max_plan_iterations": 2,
            "max_step_num": 4,
            "max_search_results": 6,
        },
        model_config={"model_name": "saved-model", "provider": "openai"},
        output_config={"language": "en", "output_format": "html"},
    )
    session_repo.get_session_config = AsyncMock(return_value=saved_config)

    service = ResearchStreamService(session_repo)
    service._get_graph = AsyncMock(return_value=MagicMock())

    captured = {}

    async def capture_stream(graph, initial_state, thread_id, execution_id, request, execution_type="continue"):
        captured["request_config"] = dict(request.config)
        if False:
            yield {}

    service._process_langgraph_stream = capture_stream

    request = _continue_request(config={})
    async for _ in service.continue_research_stream(request):
        pass

    cfg = captured["request_config"]
    assert cfg["research_config"] == saved_config.research_config
    assert cfg["model_config"] == saved_config.model_config
    assert cfg["output_config"] == saved_config.output_config
    assert cfg["auto_accepted_plan"] is True
    assert cfg["enableBackgroundInvestigation"] is False
    assert cfg["reportStyle"] == "news"
    assert cfg["maxPlanIterations"] == 2


@pytest.mark.asyncio
@pytest.mark.parametrize(
    "feedback,expected_resume",
    [
        ("edit_plan", "[edit_plan] refined question"),
        ("skip_research", "[skip_research] refined question"),
    ],
)
async def test_continue_research_stream_hitl_feedback_variants(feedback, expected_resume):
    """HITL feedback types used by the workspace UI must produce correct resume commands."""
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

    request = _continue_request(context={"interrupt_feedback": feedback})
    async for _ in service.continue_research_stream(request):
        pass

    assert isinstance(captured["initial_state"], Command)
    assert captured["initial_state"].resume == expected_resume


@pytest.mark.asyncio
async def test_continue_research_stream_resolves_thread_id_from_url_param():
    session_repo = MagicMock()
    session_repo.get_session_by_url_param = AsyncMock(
        return_value=MagicMock(id=7, thread_id="resolved-thread")
    )
    session_repo.get_session_by_thread_id = AsyncMock(
        return_value=MagicMock(id=7, thread_id="resolved-thread")
    )
    session_repo.create_execution_record = AsyncMock(
        return_value=MagicMock(execution_id="exec-1")
    )
    session_repo.get_session_config = AsyncMock(return_value=None)

    service = ResearchStreamService(session_repo)
    service._get_graph = AsyncMock(return_value=MagicMock())

    captured = {}

    async def capture_stream(graph, initial_state, thread_id, execution_id, request, execution_type="continue"):
        captured["thread_id"] = thread_id
        if False:
            yield {}

    service._process_langgraph_stream = capture_stream

    request = _continue_request(thread_id=None, url_param="my-slug", context=None)
    async for _ in service.continue_research_stream(request):
        pass

    session_repo.get_session_by_url_param.assert_awaited_once_with("my-slug")
    assert captured["thread_id"] == "resolved-thread"


@pytest.mark.asyncio
async def test_continue_research_stream_requires_thread_id_or_url_param():
    service = ResearchStreamService(session_repo=MagicMock())

    request = _continue_request(thread_id=None, url_param=None, context=None)
    events = [event async for event in service.continue_research_stream(request)]

    assert len(events) == 1
    assert events[0]["event"] == "error"
    payload = json.loads(events[0]["data"])
    assert payload["error_code"] == "CONTINUE_STREAM_ERROR"
