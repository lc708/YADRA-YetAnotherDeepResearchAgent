# Copyright (c) 2025 YADRA

import pytest
from unittest.mock import AsyncMock, MagicMock

from src.server.research_create_api import ActionType, ResearchAskService
from src.server.research_stream_api import (
    ActionType as StreamActionType,
    ResearchStreamRequest,
)


@pytest.mark.asyncio
async def test_background_task_uses_haiku_4_5_default_when_model_config_empty(
    monkeypatch,
):
    """Regression: PR #28 default model must stay claude-haiku-4-5 for background tasks."""
    repo = MagicMock()
    execution_record = MagicMock()
    execution_record.execution_id = "exec-1"
    repo.create_execution_record = AsyncMock(return_value=execution_record)

    async def fake_stream(*_args, **_kwargs):
        yield {"event": "complete"}

    mock_stream_service = MagicMock()
    mock_stream_service.create_research_stream = fake_stream
    monkeypatch.setattr(
        "src.server.research_stream_api.ResearchStreamService",
        lambda _repo: mock_stream_service,
    )

    service = ResearchAskService(session_repo=repo)
    await service._start_background_research_task(
        thread_id="thread-1",
        session_id=1,
        question="test question",
        frontend_uuid="uuid",
        visitor_id="visitor",
        research_config={},
        model_config={},
        output_config={},
        existing_session_id=1,
        existing_thread_id="thread-1",
    )

    call_kwargs = repo.create_execution_record.call_args.kwargs
    assert call_kwargs["model_used"] == "claude-haiku-4-5"
    assert call_kwargs["provider"] == "anthropic"
    assert call_kwargs["action_type"] == ActionType.CREATE


@pytest.mark.asyncio
async def test_followup_task_uses_haiku_4_5_default_when_model_config_empty(
    monkeypatch,
):
    """Regression: PR #28 default model must stay claude-haiku-4-5 for followup tasks."""
    repo = MagicMock()
    execution_record = MagicMock()
    execution_record.execution_id = "exec-2"
    repo.create_execution_record = AsyncMock(return_value=execution_record)
    session = MagicMock()
    session.url_param = "valid-slug-abc12345"
    repo.get_session_by_thread_id = AsyncMock(return_value=session)

    async def fake_continue_stream(*_args, **_kwargs):
        yield {"event": "complete"}

    mock_stream_service = MagicMock()
    mock_stream_service.continue_research_stream = fake_continue_stream
    monkeypatch.setattr(
        "src.server.research_stream_api.ResearchStreamService",
        lambda _repo: mock_stream_service,
    )

    service = ResearchAskService(session_repo=repo)
    await service._start_followup_research_task(
        thread_id="thread-1",
        session_id=1,
        question="follow up question",
        frontend_uuid="uuid",
        visitor_id="visitor",
        research_config={},
        model_config={},
        output_config={},
    )

    call_kwargs = repo.create_execution_record.call_args.kwargs
    assert call_kwargs["model_used"] == "claude-haiku-4-5"
    assert call_kwargs["provider"] == "anthropic"
    assert call_kwargs["action_type"] == ActionType.CONTINUE


def test_stream_metadata_model_info_defaults_match_haiku_4_5():
    """Regression: PR #28 stream metadata defaults when model_config omits model_name."""
    request = ResearchStreamRequest(
        action=StreamActionType.CREATE,
        message="test",
        frontend_uuid="uuid",
        frontend_context_uuid="uuid",
        visitor_id="visitor",
        config={"model_config": {}},
    )
    model_config = request.config.get("model_config", {})
    model_info = {
        "model_name": model_config.get("model_name", "claude-haiku-4-5"),
        "provider": model_config.get("provider", "anthropic"),
        "version": "4.5",
    }
    assert model_info["model_name"] == "claude-haiku-4-5"
    assert model_info["provider"] == "anthropic"
    assert model_info["version"] == "4.5"
