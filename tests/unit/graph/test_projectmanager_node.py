# Copyright (c) 2025 YADRA

import json
from unittest.mock import MagicMock

import pytest

from src.graph.nodes import projectmanager_node
from src.prompts.projectmanager_model import Plan, Step, StepType


def _valid_plan(*, has_enough_context: bool = False) -> Plan:
    return Plan(
        locale="en-US",
        has_enough_context=has_enough_context,
        thought="Need more research",
        title="Test Plan",
        steps=[
            Step(
                need_search=True,
                title="Collect data",
                description="Gather statistics",
                step_type=StepType.RESEARCH,
            )
        ],
    )


def _config(**overrides):
    return {
        "configurable": {
            "max_plan_iterations": 2,
            "max_search_results": 3,
            "enable_deep_thinking": False,
            **overrides,
        }
    }


def _state(**overrides):
    state = {
        "messages": [],
        "plan_iterations": 0,
        "enable_background_investigation": False,
    }
    state.update(overrides)
    return state


def _mock_structured_llm(plan: Plan):
    mock_llm = MagicMock()
    structured = MagicMock()
    structured.invoke.return_value = plan
    mock_llm.with_structured_output.return_value = structured
    return mock_llm, structured


def test_projectmanager_max_iterations_routes_to_reporter(monkeypatch):
    mock_llm = MagicMock()
    mock_llm.with_structured_output.return_value = MagicMock()
    monkeypatch.setattr("src.graph.nodes.get_llm_by_type", lambda _type: mock_llm)

    result = projectmanager_node(_state(plan_iterations=2), _config(max_plan_iterations=2))

    assert result.goto == "reporter"
    mock_llm.with_structured_output.return_value.invoke.assert_not_called()


def test_projectmanager_structured_plan_routes_to_human_feedback(monkeypatch):
    plan = _valid_plan(has_enough_context=False)
    mock_llm, structured = _mock_structured_llm(plan)
    monkeypatch.setattr("src.graph.nodes.get_llm_by_type", lambda _type: mock_llm)

    result = projectmanager_node(_state(), _config())

    assert result.goto == "human_feedback"
    assert result.update["current_plan"] == plan.model_dump_json(indent=4, exclude_none=True)
    structured.invoke.assert_called_once()


def test_projectmanager_enough_context_routes_to_reporter(monkeypatch):
    plan = _valid_plan(has_enough_context=True)
    mock_llm, _structured = _mock_structured_llm(plan)
    monkeypatch.setattr("src.graph.nodes.get_llm_by_type", lambda _type: mock_llm)

    result = projectmanager_node(_state(), _config())

    assert result.goto == "reporter"
    assert result.update["current_plan"] == plan


def test_projectmanager_invalid_json_first_iteration_ends_workflow(monkeypatch):
    mock_llm = MagicMock()
    structured = MagicMock()
    structured.invoke.return_value = MagicMock(
        model_dump_json=lambda **_: "not valid json"
    )
    mock_llm.with_structured_output.return_value = structured
    monkeypatch.setattr("src.graph.nodes.get_llm_by_type", lambda _type: mock_llm)

    result = projectmanager_node(_state(plan_iterations=0), _config())

    assert result.goto == "__end__"


def test_projectmanager_invalid_json_after_retry_routes_to_reporter(monkeypatch):
    mock_llm = MagicMock()
    structured = MagicMock()
    structured.invoke.return_value = MagicMock(
        model_dump_json=lambda **_: "not valid json"
    )
    mock_llm.with_structured_output.return_value = structured
    monkeypatch.setattr("src.graph.nodes.get_llm_by_type", lambda _type: mock_llm)

    result = projectmanager_node(_state(plan_iterations=1), _config())

    assert result.goto == "reporter"


def test_projectmanager_appends_background_investigation_results(monkeypatch):
    plan = _valid_plan()
    mock_llm, structured = _mock_structured_llm(plan)
    monkeypatch.setattr("src.graph.nodes.get_llm_by_type", lambda _type: mock_llm)
    monkeypatch.setattr(
        "src.graph.nodes.apply_prompt_template",
        lambda _name, _state, _config: [{"role": "user", "content": "base prompt"}],
    )

    projectmanager_node(
        _state(
            enable_background_investigation=True,
            background_investigation_results=json.dumps([{"title": "bg hit"}]),
        ),
        _config(),
    )

    messages = structured.invoke.call_args[0][0]
    assert any("background investigation results" in msg["content"] for msg in messages)


def test_projectmanager_non_basic_llm_uses_streaming_response(monkeypatch):
    """Non-basic projectmanager LLM types must use streaming instead of structured output."""
    plan_json = _valid_plan().model_dump_json()

    class _Chunk:
        def __init__(self, content):
            self.content = content

    mock_llm = MagicMock()
    mock_llm.stream.return_value = [_Chunk(plan_json)]
    monkeypatch.setattr(
        "src.graph.nodes.AGENT_LLM_MAP",
        {"projectmanager": "reasoning"},
    )
    monkeypatch.setattr("src.graph.nodes.get_llm_by_type", lambda _type: mock_llm)

    result = projectmanager_node(_state(), _config())

    assert result.goto == "human_feedback"
    mock_llm.stream.assert_called_once()
    mock_llm.with_structured_output.assert_not_called()


def test_projectmanager_deep_thinking_uses_streaming_response(monkeypatch):
    plan_json = _valid_plan().model_dump_json()

    class _Chunk:
        def __init__(self, content):
            self.content = content

    mock_llm = MagicMock()
    mock_llm.stream.return_value = [_Chunk(plan_json)]
    monkeypatch.setattr("src.graph.nodes.get_llm_by_type", lambda _type: mock_llm)

    result = projectmanager_node(_state(), _config(enable_deep_thinking=True))

    assert result.goto == "human_feedback"
    mock_llm.stream.assert_called_once()
