# Copyright (c) 2025 YADRA

import json
from unittest.mock import MagicMock

import pytest

from src.config.tools import SearchEngine
from src.graph.nodes import background_investigation_node


def _state(**overrides):
    data = {"research_topic": "quantum computing trends"}
    data.update(overrides)
    return data


def _config(max_search_results: int = 3):
    return {"configurable": {"max_search_results": max_search_results}}


def test_background_investigation_tavily_success(monkeypatch):
    monkeypatch.setattr(
        "src.graph.nodes.SELECTED_SEARCH_ENGINE", SearchEngine.TAVILY.value
    )
    mock_search = MagicMock()
    mock_search.invoke.return_value = [{"title": "Result", "url": "http://example.com"}]
    monkeypatch.setattr("src.graph.nodes.LoggedTavilySearch", lambda **_: mock_search)

    result = background_investigation_node(_state(), _config())

    payload = json.loads(result["background_investigation_results"])
    assert payload == [{"title": "Result", "url": "http://example.com"}]
    mock_search.invoke.assert_called_once_with("quantum computing trends")


def test_background_investigation_tavily_failure_returns_null_json(monkeypatch):
    """Search failures must not crash the graph; downstream nodes expect JSON null."""
    monkeypatch.setattr(
        "src.graph.nodes.SELECTED_SEARCH_ENGINE", SearchEngine.TAVILY.value
    )
    mock_search = MagicMock()
    mock_search.invoke.side_effect = RuntimeError("Tavily API unavailable")
    monkeypatch.setattr("src.graph.nodes.LoggedTavilySearch", lambda **_: mock_search)

    result = background_investigation_node(_state(), _config())

    assert result == {"background_investigation_results": json.dumps(None)}


def test_background_investigation_alternative_engine_success(monkeypatch):
    monkeypatch.setattr(
        "src.graph.nodes.SELECTED_SEARCH_ENGINE", SearchEngine.DUCKDUCKGO.value
    )
    mock_tool = MagicMock()
    mock_tool.invoke.return_value = [{"title": "DDG hit"}]
    monkeypatch.setattr("src.graph.nodes.get_web_search_tool", lambda _: mock_tool)

    result = background_investigation_node(_state(), _config())

    payload = json.loads(result["background_investigation_results"])
    assert payload == [{"title": "DDG hit"}]
    mock_tool.invoke.assert_called_once_with("quantum computing trends")


def test_background_investigation_alternative_engine_failure_returns_null_json(
    monkeypatch,
):
    monkeypatch.setattr(
        "src.graph.nodes.SELECTED_SEARCH_ENGINE", SearchEngine.DUCKDUCKGO.value
    )
    mock_tool = MagicMock()
    mock_tool.invoke.side_effect = ConnectionError("network down")
    monkeypatch.setattr("src.graph.nodes.get_web_search_tool", lambda _: mock_tool)

    result = background_investigation_node(_state(), _config())

    assert result == {"background_investigation_results": json.dumps(None)}
