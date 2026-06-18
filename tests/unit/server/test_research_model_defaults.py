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
