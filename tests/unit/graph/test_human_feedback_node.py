# Copyright (c) 2025 YADRA

import json

import pytest

from src.graph.nodes import human_feedback_node, reask_node


def _valid_plan_json(*, has_enough_context: bool = False) -> str:
    return json.dumps(
        {
            "locale": "zh-CN",
            "has_enough_context": has_enough_context,
            "thought": "Need more research",
            "title": "Test Plan",
            "steps": [
                {
                    "need_search": True,
                    "title": "Collect market data",
                    "description": "Gather AI market statistics",
                    "step_type": "research",
                }
            ],
        }
    )


def _base_state(**overrides):
    state = {
        "current_plan": _valid_plan_json(),
        "auto_accepted_plan": False,
        "plan_iterations": 0,
    }
    state.update(overrides)
    return state


def test_human_feedback_edit_plan_routes_to_projectmanager(monkeypatch):
    monkeypatch.setattr(
        "src.graph.nodes.interrupt", lambda value: "[EDIT_PLAN] revise step 1"
    )
    result = human_feedback_node(_base_state())
    assert result.goto == "projectmanager"
    assert result.update["messages"][0].content == "[EDIT_PLAN] revise step 1"


def test_human_feedback_accepted_routes_to_research_team(monkeypatch):
    monkeypatch.setattr("src.graph.nodes.interrupt", lambda value: "[ACCEPTED]")
    result = human_feedback_node(_base_state())
    assert result.goto == "research_team"
    assert result.update["plan_iterations"] == 1


def test_human_feedback_accepted_with_enough_context_routes_to_reporter(monkeypatch):
    monkeypatch.setattr("src.graph.nodes.interrupt", lambda value: "[ACCEPTED]")
    result = human_feedback_node(
        _base_state(current_plan=_valid_plan_json(has_enough_context=True))
    )
    assert result.goto == "reporter"


def test_human_feedback_skip_research_routes_to_reporter(monkeypatch):
    monkeypatch.setattr("src.graph.nodes.interrupt", lambda value: "[SKIP_RESEARCH]")
    result = human_feedback_node(_base_state())
    assert result.goto == "reporter"
    assert result.update["skipped_research"] is True


@pytest.mark.parametrize(
    "feedback",
    ["skip_research", "[skip_research]"],
)
def test_human_feedback_skip_research_accepts_lowercase_workspace_values(
    monkeypatch, feedback
):
    """Workspace UI sends lowercase interrupt_feedback; graph must still skip research."""
    monkeypatch.setattr("src.graph.nodes.interrupt", lambda value: feedback)
    result = human_feedback_node(_base_state())
    assert result.goto == "reporter"
    assert result.update["skipped_research"] is True


@pytest.mark.parametrize(
    "feedback",
    ["cancel", "[cancel]"],
)
def test_human_feedback_cancel_accepts_lowercase_workspace_values(monkeypatch, feedback):
    monkeypatch.setattr("src.graph.nodes.interrupt", lambda value: feedback)
    result = human_feedback_node(_base_state())
    assert result.goto == "__end__"
    assert "计划已取消" in result.update["messages"][0].content


def test_human_feedback_reask_accepts_lowercase_workspace_value(monkeypatch):
    monkeypatch.setattr("src.graph.nodes.interrupt", lambda value: "reask")
    result = human_feedback_node(_base_state())
    assert result.goto == "reask"


def test_human_feedback_reask_routes_to_reask_node(monkeypatch):
    monkeypatch.setattr("src.graph.nodes.interrupt", lambda value: "[REASK]")
    result = human_feedback_node(_base_state())
    assert result.goto == "reask"


def test_human_feedback_cancel_ends_workflow(monkeypatch):
    monkeypatch.setattr("src.graph.nodes.interrupt", lambda value: "[CANCEL]")
    result = human_feedback_node(_base_state())
    assert result.goto == "__end__"
    assert "计划已取消" in result.update["messages"][0].content


def test_human_feedback_skip_research_with_invalid_plan_still_routes_to_reporter(monkeypatch):
    """Invalid plan JSON during skip_research must not crash the workflow."""
    monkeypatch.setattr("src.graph.nodes.interrupt", lambda value: "[SKIP_RESEARCH]")
    result = human_feedback_node(_base_state(current_plan="not valid json"))
    assert result.goto == "reporter"
    assert result.update["skipped_research"] is True


def test_human_feedback_unsupported_interrupt_raises(monkeypatch):
    monkeypatch.setattr("src.graph.nodes.interrupt", lambda value: "[UNKNOWN]")
    with pytest.raises(TypeError, match="not supported"):
        human_feedback_node(_base_state())


def test_human_feedback_auto_accepted_skips_interrupt(monkeypatch):
    called = {"interrupt": False}

    def fail_interrupt(_value):
        called["interrupt"] = True
        raise AssertionError("interrupt should not be called when auto_accepted_plan")

    monkeypatch.setattr("src.graph.nodes.interrupt", fail_interrupt)
    result = human_feedback_node(_base_state(auto_accepted_plan=True))
    assert called["interrupt"] is False
    assert result.goto == "research_team"


def test_reask_node_without_original_input_ends_with_message():
    result = reask_node({})
    assert result.goto == "__end__"
    assert "无法找到原始输入" in result.update["messages"][0].content


def test_reask_node_restores_original_settings_and_clears_plan():
    original_input = {
        "text": "What is quantum computing?",
        "settings": {
            "auto_accepted_plan": True,
            "enable_background_investigation": False,
        },
    }
    result = reask_node(
        {
            "original_user_input": original_input,
            "current_plan": "stale plan",
            "plan_iterations": 2,
            "final_report": "old report",
        }
    )
    assert result.goto == "__end__"
    assert result.update["current_plan"] is None
    assert result.update["plan_iterations"] == 0
    assert result.update["final_report"] == ""
    assert result.update["auto_accepted_plan"] is True
    assert result.update["enable_background_investigation"] is False


def test_human_feedback_accepted_with_enough_context_routes_to_reporter_on_auto_accept(
    monkeypatch,
):
    """Auto-accepted plans with has_enough_context must bypass research_team."""
    monkeypatch.setattr("src.graph.nodes.interrupt", lambda value: pytest.fail("interrupt"))
    result = human_feedback_node(
        _base_state(
            auto_accepted_plan=True,
            current_plan=_valid_plan_json(has_enough_context=True),
        )
    )
    assert result.goto == "reporter"
    assert result.update["plan_iterations"] == 1


def test_human_feedback_accepted_invalid_json_routes_to_reporter(monkeypatch):
    """Accepted plans increment iterations before JSON parse; invalid JSON falls back to reporter."""
    monkeypatch.setattr("src.graph.nodes.interrupt", lambda value: "[ACCEPTED]")
    result = human_feedback_node(
        _base_state(current_plan="not valid json", plan_iterations=0)
    )
    assert result.goto == "reporter"
