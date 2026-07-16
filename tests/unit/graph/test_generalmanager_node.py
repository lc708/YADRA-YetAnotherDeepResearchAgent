# Copyright (c) 2025 YADRA

from unittest.mock import MagicMock

import pytest

from src.graph.nodes import generalmanager_node


def _config(**overrides):
    return {"configurable": {"max_search_results": 3, **overrides}}


def _state(**overrides):
    state = {
        "messages": [],
        "locale": "en-US",
        "research_topic": "",
        "enable_background_investigation": False,
    }
    state.update(overrides)
    return state


def _mock_llm_response(*, tool_calls=None, content=""):
    response = MagicMock()
    response.content = content
    response.tool_calls = tool_calls or []
    return response


def _handoff_tool_call(locale="zh-CN", research_topic="AI market trends"):
    return {
        "name": "handoff_to_projectmanager",
        "args": {"locale": locale, "research_topic": research_topic},
    }


def test_generalmanager_without_tool_calls_ends_workflow(monkeypatch):
    mock_llm = MagicMock()
    mock_llm.bind_tools.return_value.invoke.return_value = _mock_llm_response()
    monkeypatch.setattr("src.graph.nodes.get_llm_by_type", lambda _type: mock_llm)

    result = generalmanager_node(_state(), _config())

    assert result.goto == "__end__"
    assert result.update["locale"] == "en-US"
    assert result.update["research_topic"] == ""


def test_generalmanager_handoff_routes_to_projectmanager(monkeypatch):
    mock_llm = MagicMock()
    mock_llm.bind_tools.return_value.invoke.return_value = _mock_llm_response(
        tool_calls=[_handoff_tool_call()]
    )
    monkeypatch.setattr("src.graph.nodes.get_llm_by_type", lambda _type: mock_llm)

    result = generalmanager_node(_state(), _config())

    assert result.goto == "projectmanager"
    assert result.update["locale"] == "zh-CN"
    assert result.update["research_topic"] == "AI market trends"


def test_generalmanager_handoff_with_background_investigation_routes_to_investigator(
    monkeypatch,
):
    mock_llm = MagicMock()
    mock_llm.bind_tools.return_value.invoke.return_value = _mock_llm_response(
        tool_calls=[_handoff_tool_call()]
    )
    monkeypatch.setattr("src.graph.nodes.get_llm_by_type", lambda _type: mock_llm)

    result = generalmanager_node(
        _state(enable_background_investigation=True), _config()
    )

    assert result.goto == "background_investigator"
    assert result.update["research_topic"] == "AI market trends"


def test_generalmanager_ignores_unrelated_tool_calls(monkeypatch):
    mock_llm = MagicMock()
    mock_llm.bind_tools.return_value.invoke.return_value = _mock_llm_response(
        tool_calls=[
            {"name": "other_tool", "args": {"locale": "fr-FR", "research_topic": "ignored"}},
            _handoff_tool_call(locale="de-DE", research_topic="quantum computing"),
        ]
    )
    monkeypatch.setattr("src.graph.nodes.get_llm_by_type", lambda _type: mock_llm)

    result = generalmanager_node(_state(), _config())

    assert result.goto == "projectmanager"
    assert result.update["locale"] == "de-DE"
    assert result.update["research_topic"] == "quantum computing"


def test_generalmanager_tool_call_processing_errors_are_swallowed(monkeypatch):
    """Malformed tool call payloads must not crash the graph entry node."""

    class BrokenToolCall:
        def get(self, _key, _default=None):
            raise RuntimeError("broken tool call")

    mock_llm = MagicMock()
    mock_llm.bind_tools.return_value.invoke.return_value = _mock_llm_response(
        tool_calls=[BrokenToolCall()]
    )
    monkeypatch.setattr("src.graph.nodes.get_llm_by_type", lambda _type: mock_llm)

    result = generalmanager_node(_state(), _config())

    assert result.goto == "projectmanager"


def test_handoff_to_projectmanager_tool_is_noop_signal():
    """Handoff tool exists for LLM signaling; direct invocation must not return data."""
    from src.graph.nodes import handoff_to_projectmanager

    assert handoff_to_projectmanager.invoke(
        {"research_topic": "quantum computing", "locale": "en-US"}
    ) is None
