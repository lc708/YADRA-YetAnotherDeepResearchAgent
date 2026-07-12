# Copyright (c) 2025 YADRA

from unittest.mock import MagicMock

from langchain_core.messages import HumanMessage

from src.graph.nodes import reporter_node
from src.prompts.projectmanager_model import Plan, Step, StepType


def _plan() -> Plan:
    return Plan(
        locale="en-US",
        has_enough_context=False,
        thought="Summarize market trends",
        title="AI Market Report",
        steps=[
            Step(
                need_search=True,
                title="Collect data",
                description="Gather statistics",
                step_type=StepType.RESEARCH,
            )
        ],
    )


def _config():
    return {"configurable": {"report_style": "academic"}}


def _mock_reporter_llm(content: str = "# Final Report\n\nDone."):
    mock_response = MagicMock()
    mock_response.content = content
    mock_llm = MagicMock()
    mock_llm.invoke.return_value = mock_response
    return mock_llm


def test_reporter_node_writes_final_report(monkeypatch):
    mock_llm = _mock_reporter_llm()
    monkeypatch.setattr("src.graph.nodes.get_llm_by_type", lambda _type: mock_llm)

    result = reporter_node(
        {"current_plan": _plan(), "locale": "en-US", "observations": []},
        _config(),
    )

    assert result.update["final_report"] == "# Final Report\n\nDone."
    assert result.update["messages"][0].content == "# Final Report\n\nDone."
    mock_llm.invoke.assert_called_once()


def test_reporter_node_skipped_research_adds_disclaimer(monkeypatch):
    mock_llm = _mock_reporter_llm()
    monkeypatch.setattr("src.graph.nodes.get_llm_by_type", lambda _type: mock_llm)

    reporter_node(
        {
            "current_plan": _plan(),
            "skipped_research": True,
            "observations": [],
        },
        _config(),
    )

    invoke_messages = mock_llm.invoke.call_args[0][0]
    disclaimer_messages = [
        message
        for message in invoke_messages
        if isinstance(message, HumanMessage)
        and "skipped research" in message.content.lower()
    ]
    assert disclaimer_messages, "skipped_research must append a disclaimer prompt"


def test_reporter_node_appends_observations_to_invoke_messages(monkeypatch):
    mock_llm = _mock_reporter_llm()
    monkeypatch.setattr("src.graph.nodes.get_llm_by_type", lambda _type: mock_llm)

    reporter_node(
        {
            "current_plan": _plan(),
            "observations": ["Finding A", "Finding B"],
        },
        _config(),
    )

    invoke_messages = mock_llm.invoke.call_args[0][0]
    observation_messages = [
        message
        for message in invoke_messages
        if isinstance(message, HumanMessage) and message.name == "observation"
    ]
    assert len(observation_messages) == 2
    assert "Finding A" in observation_messages[0].content
    assert "Finding B" in observation_messages[1].content
