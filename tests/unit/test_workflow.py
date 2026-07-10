# Copyright (c) 2025 YADRA

import logging
from unittest.mock import AsyncMock, MagicMock

import pytest

import src.workflow as workflow


@pytest.fixture(autouse=True)
def reset_async_graph():
    workflow._async_graph = None
    yield
    workflow._async_graph = None


@pytest.mark.asyncio
async def test_run_agent_workflow_async_rejects_empty_input():
    with pytest.raises(ValueError, match="Input could not be empty"):
        await workflow.run_agent_workflow_async("")


@pytest.mark.asyncio
async def test_get_async_graph_caches_graph_instance(monkeypatch):
    mock_graph = MagicMock()
    create_graph = AsyncMock(return_value=mock_graph)
    monkeypatch.setattr(workflow, "create_graph", create_graph)

    first = await workflow.get_async_graph()
    second = await workflow.get_async_graph()

    assert first is mock_graph
    assert second is mock_graph
    create_graph.assert_awaited_once()


def test_enable_debug_logging_sets_src_logger_to_debug():
    src_logger = logging.getLogger("src")
    original_level = src_logger.level

    try:
        workflow.enable_debug_logging()
        assert src_logger.level == logging.DEBUG
    finally:
        src_logger.setLevel(original_level)
