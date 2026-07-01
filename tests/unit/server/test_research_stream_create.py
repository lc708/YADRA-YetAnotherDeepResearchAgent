# Copyright (c) 2025 YADRA

import json
from unittest.mock import AsyncMock, MagicMock

import pytest

from src.server.research_stream_api import (
    ActionType,
    ResearchStreamRequest,
    ResearchStreamService,
)


def _create_request(**overrides):
    data = {
        "action": ActionType.CREATE,
        "message": "new research topic",
        "frontend_uuid": "uuid-1",
        "frontend_context_uuid": "ctx-1",
        "visitor_id": "visitor-1",
        "config": {
            "reportStyle": "academic",
            "model_config": {"model_name": "custom-model", "provider": "openai"},
        },
    }
    data.update(overrides)
    return ResearchStreamRequest(**data)


@pytest.mark.asyncio
async def test_create_research_stream_reuses_existing_session():
    """When session already exists, create must not duplicate DB rows."""
    session_repo = MagicMock()
    existing_session = MagicMock(id=99, thread_id="existing-thread", url_param="slug-99")
    session_repo.get_session_by_thread_id = AsyncMock(return_value=existing_session)
    session_repo.create_session = AsyncMock()
    session_repo.create_execution_record = AsyncMock(
        return_value=MagicMock(execution_id="exec-99")
    )

    service = ResearchStreamService(session_repo)
    service._get_graph = AsyncMock(return_value=MagicMock())

    captured = {}

    async def capture_stream(graph, initial_state, thread_id, execution_id, request, execution_type="continue"):
        captured["thread_id"] = thread_id
        captured["execution_type"] = execution_type
        if False:
            yield {}

    service._process_langgraph_stream = capture_stream

    events = [
        event
        async for event in service.create_research_stream(
            _create_request(),
            existing_session_id=99,
            existing_thread_id="existing-thread",
        )
    ]

    session_repo.create_session.assert_not_called()
    session_repo.get_session_by_thread_id.assert_awaited_once_with("existing-thread")
    assert captured["thread_id"] == "existing-thread"
    assert captured["execution_type"] == "create"
    assert events == []


@pytest.mark.asyncio
async def test_create_research_stream_errors_when_existing_session_missing():
    session_repo = MagicMock()
    session_repo.get_session_by_thread_id = AsyncMock(return_value=None)
    service = ResearchStreamService(session_repo)

    events = [
        event
        async for event in service.create_research_stream(
            _create_request(),
            existing_session_id=99,
            existing_thread_id="ghost-thread",
        )
    ]

    assert len(events) == 1
    assert events[0]["event"] == "error"
    payload = json.loads(events[0]["data"])
    assert payload["error_code"] == "CREATE_STREAM_ERROR"
    assert "Session does not exist" in payload["error_message"]


@pytest.mark.asyncio
async def test_create_research_stream_creates_new_session_when_no_existing():
    session_repo = MagicMock()
    created_session = MagicMock(id=1, thread_id="new-thread")
    session_repo.create_session = AsyncMock(
        return_value=(created_session, "url-slug")
    )
    session_repo.create_execution_record = AsyncMock(
        return_value=MagicMock(execution_id="exec-1")
    )

    service = ResearchStreamService(session_repo)
    service._get_graph = AsyncMock(return_value=MagicMock())

    captured = {}

    async def capture_stream(graph, initial_state, thread_id, execution_id, request, execution_type="continue"):
        captured["thread_id"] = thread_id
        captured["initial_state"] = initial_state
        if False:
            yield {}

    service._process_langgraph_stream = capture_stream

    async for _ in service.create_research_stream(_create_request()):
        pass

    session_repo.create_session.assert_awaited_once()
    kwargs = session_repo.create_session.await_args.kwargs
    assert kwargs["initial_question"] == "new research topic"
    assert kwargs["model_config"] == {"model_name": "custom-model", "provider": "openai"}
    assert captured["initial_state"]["research_topic"] == "new research topic"
    assert captured["thread_id"] == kwargs["thread_id"]


@pytest.mark.asyncio
async def test_create_research_stream_extracts_flattened_config_when_nested_missing():
    """Legacy flat config from the web client must map into research_config on create."""
    session_repo = MagicMock()
    created_session = MagicMock(id=1, thread_id="new-thread")
    session_repo.create_session = AsyncMock(
        return_value=(created_session, "url-slug")
    )
    session_repo.create_execution_record = AsyncMock(
        return_value=MagicMock(execution_id="exec-1")
    )

    service = ResearchStreamService(session_repo)
    service._get_graph = AsyncMock(return_value=MagicMock())

    captured = {}

    async def capture_stream(graph, initial_state, thread_id, execution_id, request, execution_type="continue"):
        captured["research_config"] = request.config.get("research_config")
        if False:
            yield {}

    service._process_langgraph_stream = capture_stream

    request = _create_request(
        config={
            "auto_accepted_plan": True,
            "enableBackgroundInvestigation": False,
            "reportStyle": "news",
            "enableDeepThinking": True,
            "maxPlanIterations": 2,
            "maxStepNum": 4,
            "maxSearchResults": 6,
            "outputFormat": "html",
        }
    )

    async for _ in service.create_research_stream(request):
        pass

    create_kwargs = session_repo.create_session.await_args.kwargs
    assert create_kwargs["research_config"] == {
        "auto_accepted_plan": True,
        "enable_background_investigation": False,
        "report_style": "news",
        "enable_deep_thinking": True,
        "max_plan_iterations": 2,
        "max_step_num": 4,
        "max_search_results": 6,
    }
    assert create_kwargs["output_config"] == {
        "language": "zh-CN",
        "output_format": "html",
    }
