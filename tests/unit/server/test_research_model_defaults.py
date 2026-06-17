# Copyright (c) 2025 YADRA

import json
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from src.server.research_create_api import ActionType, ResearchAskService
from src.server.research_stream_api import (
    ActionType as StreamActionType,
    ResearchStreamRequest,
    ResearchStreamService,
)


async def _empty_astream(*_args, **_kwargs):
    if False:
        yield


def _stream_request(**overrides):
    data = {
        "action": StreamActionType.CREATE,
        "message": "test question",
        "frontend_uuid": "uuid-1",
        "frontend_context_uuid": "ctx-1",
        "visitor_id": "visitor-1",
        "config": {"model_config": {}},
    }
    data.update(overrides)
    return ResearchStreamRequest(**data)


@pytest.mark.asyncio
async def test_process_langgraph_stream_metadata_defaults_to_haiku_4_5():
    """Regression (PR #28): metadata event must use claude-haiku-4-5 when model_config is empty."""
    session_repo = MagicMock()
    session = MagicMock(id=42, thread_id="thread-abc")
    session_repo.get_session_by_thread_id = AsyncMock(return_value=session)

    service = ResearchStreamService(session_repo)
    graph = MagicMock()
    graph.astream = _empty_astream

    events = []
    async for event in service._process_langgraph_stream(
        graph,
        {},
        "thread-abc",
        "exec-1",
        _stream_request(),
        execution_type="create",
    ):
        events.append(event)
        break

    assert events[0]["event"] == "metadata"
    payload = json.loads(events[0]["data"])
    assert payload["model_info"]["model_name"] == "claude-haiku-4-5"
    assert payload["model_info"]["provider"] == "anthropic"
    assert payload["model_info"]["version"] == "4.5"


@pytest.mark.asyncio
async def test_process_langgraph_stream_metadata_respects_explicit_model_config():
    session_repo = MagicMock()
    session = MagicMock(id=42, thread_id="thread-abc")
    session_repo.get_session_by_thread_id = AsyncMock(return_value=session)

    service = ResearchStreamService(session_repo)
    graph = MagicMock()
    graph.astream = _empty_astream

    request = _stream_request(
        config={
            "model_config": {
                "model_name": "custom-model",
                "provider": "openai",
            }
        }
    )

    events = []
    async for event in service._process_langgraph_stream(
        graph, {}, "thread-abc", "exec-1", request, execution_type="create"
    ):
        events.append(event)
        break

    payload = json.loads(events[0]["data"])
    assert payload["model_info"]["model_name"] == "custom-model"
    assert payload["model_info"]["provider"] == "openai"


@pytest.mark.asyncio
async def test_background_research_task_defaults_model_in_execution_record():
    """Regression (PR #28): background tasks must persist claude-haiku-4-5 when model_config is empty."""
    session_repo = MagicMock()
    execution_record = MagicMock(execution_id="exec-1")
    session_repo.create_execution_record = AsyncMock(return_value=execution_record)

    service = ResearchAskService(session_repo)

    async def _empty_stream(*_args, **_kwargs):
        if False:
            yield

    mock_stream_service = MagicMock()
    mock_stream_service.create_research_stream = _empty_stream

    with patch(
        "src.server.research_stream_api.ResearchStreamService",
        return_value=mock_stream_service,
    ):
        await service._start_background_research_task(
            thread_id="thread-1",
            session_id=1,
            question="What is AI?",
            frontend_uuid="uuid-1",
            visitor_id="visitor-1",
            research_config={},
            model_config={},
            output_config={},
            existing_session_id=1,
            existing_thread_id="thread-1",
        )

    kwargs = session_repo.create_execution_record.await_args.kwargs
    assert kwargs["model_used"] == "claude-haiku-4-5"
    assert kwargs["provider"] == "anthropic"
    assert kwargs["action_type"] == ActionType.CREATE


@pytest.mark.asyncio
async def test_followup_research_task_defaults_model_in_execution_record():
    """Regression (PR #28): followup tasks must persist claude-haiku-4-5 when model_config is empty."""
    session_repo = MagicMock()
    execution_record = MagicMock(execution_id="exec-2")
    session = MagicMock(url_param="param-abc")
    session_repo.create_execution_record = AsyncMock(return_value=execution_record)
    session_repo.get_session_by_thread_id = AsyncMock(return_value=session)

    service = ResearchAskService(session_repo)

    async def _empty_stream(*_args, **_kwargs):
        if False:
            yield

    mock_stream_service = MagicMock()
    mock_stream_service.continue_research_stream = _empty_stream

    with patch(
        "src.server.research_stream_api.ResearchStreamService",
        return_value=mock_stream_service,
    ):
        await service._start_followup_research_task(
            thread_id="thread-2",
            session_id=2,
            question="Follow up?",
            frontend_uuid="uuid-2",
            visitor_id="visitor-2",
            research_config={},
            model_config={},
            output_config={},
        )

    kwargs = session_repo.create_execution_record.await_args.kwargs
    assert kwargs["model_used"] == "claude-haiku-4-5"
    assert kwargs["provider"] == "anthropic"
    assert kwargs["action_type"] == ActionType.CONTINUE
