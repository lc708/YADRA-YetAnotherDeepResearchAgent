# Copyright (c) 2025 YADRA

import pytest

from src.config.tools import SearchEngine
from src.tools import search as search_module
from src.tools.search import LoggedTavilySearch, get_web_search_tool


@pytest.mark.parametrize(
    "engine,logged_attr",
    [
        (SearchEngine.TAVILY.value, "LoggedTavilySearch"),
        (SearchEngine.DUCKDUCKGO.value, "LoggedDuckDuckGoSearch"),
        (SearchEngine.BRAVE_SEARCH.value, "LoggedBraveSearch"),
        (SearchEngine.ARXIV.value, "LoggedArxivSearch"),
    ],
)
def test_get_web_search_tool_returns_engine_specific_logged_tool(
    monkeypatch, engine, logged_attr
):
    sentinel = object()
    monkeypatch.setattr(search_module, "SELECTED_SEARCH_ENGINE", engine)
    monkeypatch.setattr(search_module, logged_attr, lambda **_: sentinel)

    tool = get_web_search_tool(max_search_results=5)

    assert tool is sentinel


def test_get_web_search_tool_tavily_configures_result_limits(monkeypatch):
    monkeypatch.setattr(
        search_module, "SELECTED_SEARCH_ENGINE", SearchEngine.TAVILY.value
    )
    captured = {}

    def capture_tavily(**kwargs):
        captured.update(kwargs)
        return LoggedTavilySearch.model_construct(**kwargs)

    monkeypatch.setattr(search_module, "LoggedTavilySearch", capture_tavily)

    get_web_search_tool(max_search_results=7)

    assert captured["max_results"] == 7
    assert captured["include_raw_content"] is True
    assert captured["include_images"] is True


def test_get_web_search_tool_rejects_unknown_engine(monkeypatch):
    monkeypatch.setattr(search_module, "SELECTED_SEARCH_ENGINE", "unsupported-engine")

    with pytest.raises(ValueError, match="Unsupported search engine"):
        get_web_search_tool(max_search_results=3)
