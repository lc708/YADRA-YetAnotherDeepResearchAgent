# Copyright (c) 2025 YADRA

from unittest.mock import AsyncMock, MagicMock

import pytest

from src.tools.tavily_search.tavily_search_results_with_images import (
    TavilySearchResultsWithImages,
)


def _tool_with_mock_api():
    tool = TavilySearchResultsWithImages()
    tool.api_wrapper = MagicMock()
    return tool


def test_tavily_search_run_returns_error_repr_on_api_failure():
    tool = _tool_with_mock_api()
    tool.api_wrapper.raw_results.side_effect = RuntimeError("Tavily API unavailable")

    result, raw = tool._run("quantum computing")

    assert "Tavily API unavailable" in result
    assert raw == {}


@pytest.mark.asyncio
async def test_tavily_search_arun_returns_error_repr_on_api_failure():
    tool = _tool_with_mock_api()
    tool.api_wrapper.raw_results_async = AsyncMock(
        side_effect=RuntimeError("async Tavily failure")
    )

    result, raw = await tool._arun("quantum computing")

    assert "async Tavily failure" in result
    assert raw == {}


def test_tavily_search_run_returns_cleaned_results_on_success():
    tool = _tool_with_mock_api()
    raw_results = {
        "results": [{"title": "T", "url": "http://x", "content": "C", "score": 0.9}],
        "images": [],
    }
    cleaned = [{"type": "page", "title": "T", "url": "http://x", "content": "C", "score": 0.9}]
    tool.api_wrapper.raw_results.return_value = raw_results
    tool.api_wrapper.clean_results_with_images.return_value = cleaned

    result, raw = tool._run("test query")

    assert result == cleaned
    assert raw is raw_results
    tool.api_wrapper.clean_results_with_images.assert_called_once_with(raw_results)


@pytest.mark.asyncio
async def test_tavily_search_arun_returns_cleaned_results_on_success():
    tool = _tool_with_mock_api()
    raw_results = {
        "results": [{"title": "T", "url": "http://x", "content": "C", "score": 0.9}],
        "images": [],
    }
    cleaned = [{"type": "page", "title": "T", "url": "http://x", "content": "C", "score": 0.9}]
    tool.api_wrapper.raw_results_async = AsyncMock(return_value=raw_results)
    tool.api_wrapper.clean_results_with_images.return_value = cleaned

    result, raw = await tool._arun("test query")

    assert result == cleaned
    assert raw is raw_results
