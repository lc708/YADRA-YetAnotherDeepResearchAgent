# Copyright (c) 2025 YADRA

import json
from unittest.mock import AsyncMock, MagicMock

import pytest

from src.server.research_create_api import ResearchAskService
from src.server.research_stream_api import (
    ActionType,
    ResearchStreamRequest,
    ResearchStreamService,
)


async def _empty_astream(*_args, **_kwargs):
    if False:
        yield None


@pytest.mark.asyncio
async def test_stream_metadata_respects_explicit_model_config():
    """Explicit model_config must override PR #28 haiku defaults in metadata events."""
    session_repo = MagicMock()
    session_repo.get_session_by_thread_id = AsyncMock(
        return_value=MagicMock(id=1, thread_id="thread-1")
    )

    mock_graph = MagicMock()
    mock_graph.astream = _empty_astream
    mock_graph.aget_state = AsyncMock(return_value=MagicMock())

    service = ResearchStreamService(session_repo)
    request = ResearchStreamRequest(
        action=ActionType.CREATE,
        message="test question",
        frontend_uuid="uuid",
        frontend_context_uuid="uuid",
        visitor_id="visitor",
        config={
            "model_config": {
                "model_name": "custom-model",
                "provider": "openai",
            }
        },
    )

    events = [
        event
        async for event in service._process_langgraph_stream(
            mock_graph, {}, "thread-1", "exec-1", request
        )
    ]

    metadata = next(event for event in events if event["event"] == "metadata")
    payload = json.loads(metadata["data"])
    assert payload["model_info"]["model_name"] == "custom-model"
    assert payload["model_info"]["provider"] == "openai"


@pytest.mark.asyncio
async def test_stream_metadata_defaults_to_claude_haiku_4_5():
    """Regression: PR #28 metadata event must default to claude-haiku-4-5 in production code."""
    session_repo = MagicMock()
    session_repo.get_session_by_thread_id = AsyncMock(
        return_value=MagicMock(id=1, thread_id="thread-1")
    )

    mock_graph = MagicMock()
    mock_graph.astream = _empty_astream
    mock_graph.aget_state = AsyncMock(return_value=MagicMock())

    service = ResearchStreamService(session_repo)
    request = ResearchStreamRequest(
        action=ActionType.CREATE,
        message="test question",
        frontend_uuid="uuid",
        frontend_context_uuid="uuid",
        visitor_id="visitor",
        config={"model_config": {}},
    )

    events = [
        event
        async for event in service._process_langgraph_stream(
            mock_graph, {}, "thread-1", "exec-1", request
        )
    ]

    metadata = next(event for event in events if event["event"] == "metadata")
    payload = json.loads(metadata["data"])
    assert payload["model_info"]["model_name"] == "claude-haiku-4-5"
    assert payload["model_info"]["provider"] == "anthropic"
    assert payload["model_info"]["version"] == "4.5"


def test_create_api_execution_model_defaults_match_haiku_4_5():
    """Regression: background/followup tasks must default to claude-haiku-4-5."""
    _, model_config, _ = ResearchAskService(session_repo=MagicMock())._parse_config({})
    model_used = model_config.get("model_name", "claude-haiku-4-5")
    provider = model_config.get("provider", "anthropic")
    assert model_used == "claude-haiku-4-5"
    assert provider == "anthropic"


async def _immediate_complete_stream(*_args, **_kwargs):
    yield {"event": "complete", "data": "{}"}


@pytest.mark.asyncio
async def test_background_research_task_records_haiku_default(monkeypatch):
    """PR #28: execution records must default model_used when model_config is empty."""
    session_repo = MagicMock()
    execution = MagicMock(execution_id="exec-1")
    session_repo.create_execution_record = AsyncMock(return_value=execution)
    session_repo.update_execution_record = AsyncMock()

    mock_stream_service = MagicMock()
    mock_stream_service.create_research_stream = _immediate_complete_stream
    monkeypatch.setattr(
        "src.server.research_stream_api.ResearchStreamService",
        MagicMock(return_value=mock_stream_service),
    )

    service = ResearchAskService(session_repo=session_repo)
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


@pytest.mark.asyncio
async def test_followup_research_task_records_haiku_default(monkeypatch):
    """PR #28: followup execution records must default model_used when model_config is empty."""
    session_repo = MagicMock()
    execution = MagicMock(execution_id="exec-2")
    session_repo.create_execution_record = AsyncMock(return_value=execution)
    session_repo.update_execution_record = AsyncMock()
    session_repo.get_session_by_thread_id = AsyncMock(
        return_value=MagicMock(url_param="test-slug")
    )

    mock_stream_service = MagicMock()
    mock_stream_service.continue_research_stream = _immediate_complete_stream
    monkeypatch.setattr(
        "src.server.research_stream_api.ResearchStreamService",
        MagicMock(return_value=mock_stream_service),
    )

    service = ResearchAskService(session_repo=session_repo)
    await service._start_followup_research_task(
        thread_id="thread-2",
        session_id=2,
        question="Follow up question",
        frontend_uuid="uuid-2",
        visitor_id="visitor-2",
        research_config={},
        model_config={},
        output_config={},
    )

    kwargs = session_repo.create_execution_record.await_args.kwargs
    assert kwargs["model_used"] == "claude-haiku-4-5"
    assert kwargs["provider"] == "anthropic"
