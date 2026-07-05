# Copyright (c) 2025 YADRA

import json
from datetime import datetime
from unittest.mock import AsyncMock, MagicMock

import pytest

from src.server.repositories.session_repository import ExecutionStatus
from src.server.research_create_api import ResearchAskService


async def _immediate_complete_stream(*_args, **_kwargs):
    yield {"event": "complete", "data": "{}"}


async def _immediate_error_stream_json(*_args, **_kwargs):
    yield {
        "event": "error",
        "data": json.dumps({"error_message": "graph exploded"}),
    }


async def _immediate_error_stream_raw(*_args, **_kwargs):
    yield {"event": "error", "data": "plain failure text"}


@pytest.mark.asyncio
async def test_background_task_marks_execution_completed_on_stream_complete(monkeypatch):
    """Non-stream initial ask must mark execution COMPLETED when background stream finishes."""
    session_repo = MagicMock()
    execution = MagicMock(execution_id="exec-done")
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

    update_kwargs = session_repo.update_execution_record.await_args.kwargs
    assert update_kwargs["execution_id"] == "exec-done"
    assert update_kwargs["status"] == ExecutionStatus.COMPLETED
    assert isinstance(update_kwargs["end_time"], datetime)


@pytest.mark.asyncio
async def test_background_task_marks_execution_error_on_stream_error_json(monkeypatch):
    """Background task must persist structured stream error payloads to execution records."""
    session_repo = MagicMock()
    execution = MagicMock(execution_id="exec-err")
    session_repo.create_execution_record = AsyncMock(return_value=execution)
    session_repo.update_execution_record = AsyncMock()

    mock_stream_service = MagicMock()
    mock_stream_service.create_research_stream = _immediate_error_stream_json
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

    update_kwargs = session_repo.update_execution_record.await_args.kwargs
    assert update_kwargs["status"] == ExecutionStatus.ERROR
    assert update_kwargs["error_message"] == "graph exploded"


@pytest.mark.asyncio
async def test_background_task_marks_execution_error_on_stream_error_raw_string(monkeypatch):
    """Non-JSON error payloads from the stream must still be persisted."""
    session_repo = MagicMock()
    execution = MagicMock(execution_id="exec-raw")
    session_repo.create_execution_record = AsyncMock(return_value=execution)
    session_repo.update_execution_record = AsyncMock()

    mock_stream_service = MagicMock()
    mock_stream_service.create_research_stream = _immediate_error_stream_raw
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

    update_kwargs = session_repo.update_execution_record.await_args.kwargs
    assert update_kwargs["status"] == ExecutionStatus.ERROR
    assert update_kwargs["error_message"] == "plain failure text"


@pytest.mark.asyncio
async def test_background_task_handles_create_stream_exception(monkeypatch):
    """Unhandled exceptions during background streaming must mark execution ERROR."""
    session_repo = MagicMock()
    execution = MagicMock(execution_id="exec-boom")
    session_repo.create_execution_record = AsyncMock(return_value=execution)
    session_repo.update_execution_record = AsyncMock()

    async def boom(*_args, **_kwargs):
        raise RuntimeError("stream service unavailable")
        yield {"event": "complete", "data": "{}"}  # pragma: no cover

    mock_stream_service = MagicMock()
    mock_stream_service.create_research_stream = boom
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

    update_kwargs = session_repo.update_execution_record.await_args.kwargs
    assert update_kwargs["status"] == ExecutionStatus.ERROR
    assert update_kwargs["error_message"] == "stream service unavailable"


@pytest.mark.asyncio
async def test_followup_task_marks_execution_completed_on_stream_complete(monkeypatch):
    session_repo = MagicMock()
    execution = MagicMock(execution_id="exec-followup")
    session_repo.create_execution_record = AsyncMock(return_value=execution)
    session_repo.update_execution_record = AsyncMock()
    session_repo.get_session_by_thread_id = AsyncMock(
        return_value=MagicMock(url_param="slug-1")
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
        question="Follow up",
        frontend_uuid="uuid-2",
        visitor_id="visitor-2",
        research_config={},
        model_config={},
        output_config={},
    )

    update_kwargs = session_repo.update_execution_record.await_args.kwargs
    assert update_kwargs["status"] == ExecutionStatus.COMPLETED


@pytest.mark.asyncio
async def test_followup_task_marks_error_when_session_missing(monkeypatch):
    """Followup background task must fail fast when thread_id cannot resolve url_param."""
    session_repo = MagicMock()
    execution = MagicMock(execution_id="exec-missing")
    session_repo.create_execution_record = AsyncMock(return_value=execution)
    session_repo.update_execution_record = AsyncMock()
    session_repo.get_session_by_thread_id = AsyncMock(return_value=None)

    monkeypatch.setattr(
        "src.server.research_stream_api.ResearchStreamService",
        MagicMock(return_value=MagicMock()),
    )

    service = ResearchAskService(session_repo=session_repo)
    await service._start_followup_research_task(
        thread_id="ghost-thread",
        session_id=2,
        question="Follow up",
        frontend_uuid="uuid-2",
        visitor_id="visitor-2",
        research_config={},
        model_config={},
        output_config={},
    )

    update_kwargs = session_repo.update_execution_record.await_args.kwargs
    assert update_kwargs["status"] == ExecutionStatus.ERROR
    assert "Session not found" in update_kwargs["error_message"]


@pytest.mark.asyncio
async def test_followup_task_marks_execution_error_on_stream_error(monkeypatch):
    session_repo = MagicMock()
    execution = MagicMock(execution_id="exec-followup-err")
    session_repo.create_execution_record = AsyncMock(return_value=execution)
    session_repo.update_execution_record = AsyncMock()
    session_repo.get_session_by_thread_id = AsyncMock(
        return_value=MagicMock(url_param="slug-2")
    )

    mock_stream_service = MagicMock()
    mock_stream_service.continue_research_stream = _immediate_error_stream_json
    monkeypatch.setattr(
        "src.server.research_stream_api.ResearchStreamService",
        MagicMock(return_value=mock_stream_service),
    )

    service = ResearchAskService(session_repo=session_repo)
    await service._start_followup_research_task(
        thread_id="thread-2",
        session_id=2,
        question="Follow up",
        frontend_uuid="uuid-2",
        visitor_id="visitor-2",
        research_config={},
        model_config={},
        output_config={},
    )

    update_kwargs = session_repo.update_execution_record.await_args.kwargs
    assert update_kwargs["status"] == ExecutionStatus.ERROR
    assert update_kwargs["error_message"] == "graph exploded"


@pytest.mark.asyncio
async def test_followup_task_marks_execution_error_on_stream_error_raw_string(monkeypatch):
    """Non-JSON followup stream errors must still be persisted to execution records."""
    session_repo = MagicMock()
    execution = MagicMock(execution_id="exec-followup-raw")
    session_repo.create_execution_record = AsyncMock(return_value=execution)
    session_repo.update_execution_record = AsyncMock()
    session_repo.get_session_by_thread_id = AsyncMock(
        return_value=MagicMock(url_param="slug-2")
    )

    mock_stream_service = MagicMock()
    mock_stream_service.continue_research_stream = _immediate_error_stream_raw
    monkeypatch.setattr(
        "src.server.research_stream_api.ResearchStreamService",
        MagicMock(return_value=mock_stream_service),
    )

    service = ResearchAskService(session_repo=session_repo)
    await service._start_followup_research_task(
        thread_id="thread-2",
        session_id=2,
        question="Follow up",
        frontend_uuid="uuid-2",
        visitor_id="visitor-2",
        research_config={},
        model_config={},
        output_config={},
    )

    update_kwargs = session_repo.update_execution_record.await_args.kwargs
    assert update_kwargs["status"] == ExecutionStatus.ERROR
    assert update_kwargs["error_message"] == "plain failure text"


@pytest.mark.asyncio
async def test_background_task_swallows_execution_update_failure(monkeypatch):
    """Background task must not raise when persisting ERROR status also fails."""
    session_repo = MagicMock()
    session_repo.create_execution_record = AsyncMock(
        side_effect=RuntimeError("create execution failed")
    )
    session_repo.update_execution_record = AsyncMock(side_effect=OSError("db down"))

    monkeypatch.setattr(
        "src.server.research_stream_api.ResearchStreamService",
        MagicMock(return_value=MagicMock()),
    )

    service = ResearchAskService(session_repo=session_repo)
    await service._start_background_research_task(
        thread_id="thread-fail",
        session_id=1,
        question="What is AI?",
        frontend_uuid="uuid-1",
        visitor_id="visitor-1",
        research_config={},
        model_config={},
        output_config={},
        existing_session_id=1,
        existing_thread_id="thread-fail",
    )

    session_repo.update_execution_record.assert_awaited()
    assert (
        session_repo.update_execution_record.await_args.kwargs["execution_id"]
        == "thread-fail"
    )


@pytest.mark.asyncio
async def test_followup_task_swallows_execution_update_failure(monkeypatch):
    """Followup background task must not raise when ERROR persistence fails."""
    session_repo = MagicMock()
    session_repo.create_execution_record = AsyncMock(
        side_effect=RuntimeError("create execution failed")
    )
    session_repo.update_execution_record = AsyncMock(side_effect=OSError("db down"))

    monkeypatch.setattr(
        "src.server.research_stream_api.ResearchStreamService",
        MagicMock(return_value=MagicMock()),
    )

    service = ResearchAskService(session_repo=session_repo)
    await service._start_followup_research_task(
        thread_id="thread-followup-fail",
        session_id=2,
        question="Follow up",
        frontend_uuid="uuid-2",
        visitor_id="visitor-2",
        research_config={},
        model_config={},
        output_config={},
    )

    session_repo.update_execution_record.assert_awaited()
    assert (
        session_repo.update_execution_record.await_args.kwargs["execution_id"]
        == "thread-followup-fail"
    )
