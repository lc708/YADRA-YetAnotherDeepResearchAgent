# Copyright (c) 2025 YADRA

"""Regression tests for checkpoint/thread state API (thread recovery and fork)."""

from datetime import datetime
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from fastapi import HTTPException

from src.server.checkpoint_api import (
    ResumeRequest,
    StateUpdate,
    fork_thread,
    get_checkpoints,
    get_thread_state,
    resume_thread_execution,
    update_thread_state,
)


def _checkpoint_tuple(*, checkpoint_id: str, parent_id: str | None = "parent-cp"):
    parent_config = (
        {"configurable": {"checkpoint_id": parent_id}} if parent_id else None
    )
    checkpoint = MagicMock()
    checkpoint.config = {"configurable": {"checkpoint_id": checkpoint_id}}
    checkpoint.checkpoint = {"ts": datetime(2026, 1, 15, 12, 0, 0)}
    checkpoint.metadata = {"source": "test"}
    checkpoint.parent_config = parent_config
    return checkpoint


def _state_snapshot(
    *,
    thread_id: str = "thread-1",
    checkpoint_id: str = "cp-1",
    values: dict | None = None,
    parent_id: str | None = None,
    use_checkpoint_ns: bool = False,
):
    configurable = (
        {"thread_id": thread_id, "checkpoint_ns": checkpoint_id}
        if use_checkpoint_ns
        else {"thread_id": thread_id, "checkpoint_id": checkpoint_id}
    )
    snapshot = MagicMock()
    snapshot.config = {"configurable": configurable}
    snapshot.values = values if values is not None else {"messages": []}
    snapshot.metadata = {"step": 1}
    snapshot.created_at = datetime(2026, 1, 15, 12, 0, 0)
    snapshot.parent_config = (
        {"configurable": {"checkpoint_id": parent_id}} if parent_id else None
    )
    return snapshot


@pytest.fixture
def mock_graph():
    graph = MagicMock()
    graph.checkpointer = MagicMock()
    graph.aget_state = AsyncMock()
    graph.aupdate_state = AsyncMock()
    graph.astream = MagicMock()
    return graph


@pytest.fixture
def patch_graph_instance(mock_graph):
    with patch(
        "src.server.checkpoint_api.get_graph_instance",
        AsyncMock(return_value=mock_graph),
    ):
        yield mock_graph


@pytest.mark.asyncio
async def test_get_checkpoints_returns_checkpoint_history(patch_graph_instance):
    mock_graph = patch_graph_instance
    tuples = [
        _checkpoint_tuple(checkpoint_id="cp-2", parent_id="cp-1"),
        _checkpoint_tuple(checkpoint_id="cp-1", parent_id=None),
    ]

    async def mock_alist(_config):
        for item in tuples:
            yield item

    mock_graph.checkpointer.alist = mock_alist

    result = await get_checkpoints("thread-1", limit=10)

    assert len(result) == 2
    assert result[0].checkpoint_id == "cp-2"
    assert result[0].thread_id == "thread-1"
    assert result[0].parent_checkpoint_id == "cp-1"
    assert result[1].parent_checkpoint_id is None


@pytest.mark.asyncio
async def test_get_checkpoints_respects_limit(patch_graph_instance):
    mock_graph = patch_graph_instance

    async def mock_alist(_config):
        for idx in range(5):
            yield _checkpoint_tuple(checkpoint_id=f"cp-{idx}", parent_id=None)

    mock_graph.checkpointer.alist = mock_alist

    result = await get_checkpoints("thread-1", limit=2)

    assert len(result) == 2
    assert result[0].checkpoint_id == "cp-0"
    assert result[1].checkpoint_id == "cp-1"


@pytest.mark.asyncio
async def test_get_checkpoints_wraps_checkpointer_errors(patch_graph_instance):
    mock_graph = patch_graph_instance

    async def failing_alist(_config):
        raise RuntimeError("checkpointer unavailable")
        yield  # pragma: no cover

    mock_graph.checkpointer.alist = failing_alist

    with pytest.raises(HTTPException) as exc:
        await get_checkpoints("thread-1")

    assert exc.value.status_code == 500
    assert "checkpointer unavailable" in exc.value.detail


@pytest.mark.asyncio
async def test_get_thread_state_returns_snapshot(patch_graph_instance):
    mock_graph = patch_graph_instance
    mock_graph.aget_state.return_value = _state_snapshot(
        values={"current_plan": "plan-json"}
    )

    result = await get_thread_state("thread-1")

    assert result.thread_id == "thread-1"
    assert result.checkpoint_id == "cp-1"
    assert result.state == {"current_plan": "plan-json"}
    assert result.metadata == {"step": 1}


@pytest.mark.asyncio
async def test_get_thread_state_uses_checkpoint_ns_fallback(patch_graph_instance):
    mock_graph = patch_graph_instance
    mock_graph.aget_state.return_value = _state_snapshot(use_checkpoint_ns=True)

    result = await get_thread_state("thread-1")

    assert result.checkpoint_id == "cp-1"


@pytest.mark.asyncio
async def test_get_thread_state_not_found_raises_404(patch_graph_instance):
    mock_graph = patch_graph_instance
    mock_graph.aget_state.return_value = MagicMock(values=None)

    with pytest.raises(HTTPException) as exc:
        await get_thread_state("missing-thread")

    assert exc.value.status_code == 404


@pytest.mark.asyncio
async def test_update_thread_state_applies_updates(patch_graph_instance):
    mock_graph = patch_graph_instance
    mock_graph.aget_state.side_effect = [
        _state_snapshot(values={"messages": []}),
        _state_snapshot(values={"messages": [{"role": "user", "content": "hi"}]}),
    ]

    result = await update_thread_state(
        "thread-1",
        StateUpdate(updates={"messages": [{"role": "user", "content": "hi"}]}),
    )

    mock_graph.aupdate_state.assert_awaited_once_with(
        {"configurable": {"thread_id": "thread-1"}},
        {"messages": [{"role": "user", "content": "hi"}]},
    )
    assert result.state["messages"][0]["content"] == "hi"
    assert "updated_at" in result.metadata


@pytest.mark.asyncio
async def test_update_thread_state_missing_thread_raises_error(patch_graph_instance):
    """update_thread_state currently wraps HTTPException into 500 (regression guard)."""
    mock_graph = patch_graph_instance
    mock_graph.aget_state.return_value = None

    with pytest.raises(HTTPException) as exc:
        await update_thread_state("thread-1", StateUpdate(updates={"foo": "bar"}))

    assert exc.value.status_code == 500


@pytest.mark.asyncio
async def test_resume_thread_execution_streams_state_updates(patch_graph_instance):
    mock_graph = patch_graph_instance
    mock_graph.aget_state.return_value = _state_snapshot()

    async def mock_astream(_inputs, _config, stream_mode="values"):
        assert stream_mode == "values"
        yield {"messages": []}
        yield {"messages": [{"role": "assistant", "content": "done"}]}

    mock_graph.astream = mock_astream

    response = await resume_thread_execution(
        "thread-1",
        ResumeRequest(inputs={"resume": True}),
    )

    chunks = [chunk async for chunk in response.body_iterator]
    body = "".join(chunks)

    assert "state_update" in body
    assert "complete" in body
    assert "thread-1" in body


@pytest.mark.asyncio
async def test_resume_thread_execution_not_found_raises_404(patch_graph_instance):
    mock_graph = patch_graph_instance
    mock_graph.aget_state.return_value = None

    with pytest.raises(HTTPException) as exc:
        await resume_thread_execution("thread-1", ResumeRequest())

    assert exc.value.status_code == 404


@pytest.mark.asyncio
async def test_fork_thread_copies_state_to_new_thread(patch_graph_instance):
    mock_graph = patch_graph_instance
    source = _state_snapshot(values={"messages": [{"role": "user", "content": "q"}]})
    forked = _state_snapshot(
        thread_id="new-thread",
        checkpoint_id="cp-new",
        values={"messages": [{"role": "user", "content": "q"}]},
    )
    mock_graph.aget_state.side_effect = [source, forked]

    result = await fork_thread("thread-1", checkpoint_id="cp-1", new_thread_id="new-thread")

    mock_graph.aupdate_state.assert_awaited_once()
    update_args = mock_graph.aupdate_state.await_args
    assert update_args.args[0] == {"configurable": {"thread_id": "new-thread"}}
    assert update_args.args[1] == source.values
    assert update_args.kwargs["as_node"] == "__start__"
    assert result.thread_id == "new-thread"
    assert result.state["messages"][0]["content"] == "q"


@pytest.mark.asyncio
async def test_fork_thread_source_not_found_raises_error(patch_graph_instance):
    """fork_thread currently wraps HTTPException into 500 (regression guard)."""
    mock_graph = patch_graph_instance
    mock_graph.aget_state.return_value = None

    with pytest.raises(HTTPException) as exc:
        await fork_thread("missing-thread")

    assert exc.value.status_code == 500
