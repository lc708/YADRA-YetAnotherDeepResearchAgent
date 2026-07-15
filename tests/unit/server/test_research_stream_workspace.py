# Copyright (c) 2025 YADRA

from contextlib import asynccontextmanager
from datetime import datetime, timezone
from unittest.mock import AsyncMock, MagicMock

import pytest
from fastapi import HTTPException

from src.server.research_stream_api import get_workspace_data


def _session(**overrides):
    session = MagicMock()
    session.id = 42
    session.thread_id = "thread-abc"
    session.url_param = "my-slug"
    session.status = "active"
    session.created_at = datetime(2026, 1, 1, tzinfo=timezone.utc)
    session.updated_at = datetime(2026, 1, 2, tzinfo=timezone.utc)
    for key, value in overrides.items():
        setattr(session, key, value)
    return session


@pytest.mark.asyncio
async def test_get_workspace_data_returns_error_for_missing_session():
    """Missing sessions must not return workspace data (currently wrapped as 500)."""
    session_repo = MagicMock()
    session_repo.get_session_by_url_param = AsyncMock(return_value=None)

    with pytest.raises(HTTPException) as exc:
        await get_workspace_data("missing-slug", session_repo=session_repo)

    assert exc.value.status_code == 500
    assert "Session does not exist" in exc.value.detail


@pytest.mark.asyncio
async def test_get_workspace_data_assembles_workspace_payload():
    """Workspace view depends on aggregated session, messages, executions, and config."""
    session_repo = MagicMock()
    session_repo.get_session_by_url_param = AsyncMock(return_value=_session())
    created_at = datetime(2026, 1, 1, 12, 0, tzinfo=timezone.utc)
    session_repo.get_messages_by_session_id = AsyncMock(
        return_value=[
            {
                "message_id": "msg-1",
                "content": "Hello",
                "role": "user",
                "timestamp": created_at,
                "frontend_context_uuid": "ctx-1",
                "source_agent": None,
            }
        ]
    )
    session_repo.get_execution_records_by_session_id = AsyncMock(
        return_value=[
            {
                "execution_id": "exec-1",
                "action_type": "create",
                "created_at": created_at,
                "status": "completed",
                "input_tokens": 10,
                "output_tokens": 20,
                "total_cost": 0.05,
                "duration_ms": 1500,
            }
        ]
    )
    saved_config = MagicMock(
        research_config={"report_style": "academic"},
        model_config={"model_name": "claude-haiku-4-5", "provider": "anthropic"},
        output_config={"language": "zh-CN", "output_format": "markdown"},
        user_preferences={"theme": "dark"},
    )
    session_repo.get_session_config = AsyncMock(return_value=saved_config)
    session_repo.get_connection = AsyncMock(return_value=_artifact_connection([]))

    result = await get_workspace_data("my-slug", session_repo=session_repo)

    assert result["thread_id"] == "thread-abc"
    assert result["url_param"] == "my-slug"
    assert result["status"] == "active"
    assert result["messages"][0]["content"] == "Hello"
    assert result["config"]["current_config"]["model_config"]["model_name"] == "claude-haiku-4-5"
    assert result["execution_stats"]["total_tokens_used"] == 30
    assert result["execution_stats"]["total_cost"] == 0.05
    assert result["execution_stats"]["average_response_time"] == 1500
    assert result["permissions"]["can_modify"] is True


def _artifact_connection(rows):
    cursor = MagicMock()
    cursor.execute = AsyncMock()
    cursor.fetchall = AsyncMock(return_value=rows)
    conn = MagicMock()
    conn.cursor = MagicMock(return_value=cursor)

    @asynccontextmanager
    async def connection_ctx():
        yield conn

    return connection_ctx()


@pytest.mark.asyncio
async def test_get_workspace_data_includes_artifacts_when_query_succeeds():
    session_repo = MagicMock()
    session_repo.get_session_by_url_param = AsyncMock(return_value=_session())
    session_repo.get_messages_by_session_id = AsyncMock(return_value=[])
    session_repo.get_execution_records_by_session_id = AsyncMock(return_value=[])
    session_repo.get_session_config = AsyncMock(return_value=None)

    artifact_created = datetime(2026, 1, 3, tzinfo=timezone.utc)
    rows = [
        {
            "artifact_id": "art-1",
            "type": "report",
            "title": "Final Report",
            "description": "Summary",
            "content": "# Report",
            "content_format": "markdown",
            "source_agent": "writer",
            "created_at": artifact_created,
        }
    ]
    session_repo.get_connection = AsyncMock(return_value=_artifact_connection(rows))

    result = await get_workspace_data("my-slug", session_repo=session_repo)

    assert len(result["artifacts"]) == 1
    assert result["artifacts"][0]["id"] == "art-1"
    assert result["artifacts"][0]["title"] == "Final Report"
    assert result["artifacts"][0]["created_at"] == artifact_created.isoformat()


@pytest.mark.asyncio
async def test_get_workspace_data_survives_artifact_query_failure():
    """Artifact fetch failures must not break the workspace response."""
    session_repo = MagicMock()
    session_repo.get_session_by_url_param = AsyncMock(return_value=_session())
    session_repo.get_messages_by_session_id = AsyncMock(return_value=[])
    session_repo.get_execution_records_by_session_id = AsyncMock(return_value=[])
    session_repo.get_session_config = AsyncMock(return_value=None)
    session_repo.get_connection = AsyncMock(side_effect=RuntimeError("db down"))

    result = await get_workspace_data("my-slug", session_repo=session_repo)

    assert result["artifacts"] == []
    assert result["thread_id"] == "thread-abc"
