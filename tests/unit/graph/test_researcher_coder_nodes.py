# Copyright (c) 2025 YADRA

from unittest.mock import AsyncMock, MagicMock

import pytest

from src.graph.nodes import (
    _execute_agent_step,
    coder_node,
    researcher_node,
)
from src.prompts.projectmanager_model import Plan, Step, StepType
from src.rag import Resource


def _plan(*, executed: bool = False) -> Plan:
    step = Step(
        need_search=True,
        title="Collect data",
        description="Gather statistics",
        step_type=StepType.RESEARCH,
    )
    if executed:
        step.execution_res = "already done"
    return Plan(
        locale="en-US",
        has_enough_context=False,
        thought="Need more research",
        title="Test Plan",
        steps=[step],
    )


def _multi_step_plan() -> Plan:
    completed = Step(
        need_search=True,
        title="Prior research",
        description="Already executed",
        step_type=StepType.RESEARCH,
    )
    completed.execution_res = "prior finding content"
    pending = Step(
        need_search=True,
        title="Next step",
        description="Still pending",
        step_type=StepType.RESEARCH,
    )
    return Plan(
        locale="en-US",
        has_enough_context=False,
        thought="Continue research",
        title="Multi-step Plan",
        steps=[completed, pending],
    )


def _mcp_config(*, agent_type: str = "researcher"):
    return {
        "configurable": {
            "max_search_results": 5,
            "mcp_settings": {
                "servers": {
                    "test_server": {
                        "enabled_tools": ["mcp_search"],
                        "add_to_agents": [agent_type],
                        "transport": "stdio",
                        "command": "echo",
                        "args": [],
                    }
                }
            },
        }
    }


def _config(**overrides):
    return {"configurable": {"max_search_results": 5, **overrides}}


def _mock_agent(response: str = "step result"):
    mock_agent = AsyncMock()
    mock_agent.ainvoke.return_value = {"messages": [MagicMock(content=response)]}
    return mock_agent


@pytest.mark.asyncio
async def test_execute_agent_step_runs_first_unexecuted_step():
    plan = _plan()
    mock_agent = _mock_agent("research findings")

    result = await _execute_agent_step(
        {"current_plan": plan, "observations": ["prior"]},
        mock_agent,
        "researcher",
    )

    assert result.goto == "research_team"
    assert plan.steps[0].execution_res == "research findings"
    assert result.update["observations"] == ["prior", "research findings"]
    mock_agent.ainvoke.assert_awaited_once()


@pytest.mark.asyncio
async def test_execute_agent_step_includes_completed_step_findings():
    """Multi-step plans must pass prior findings into the next agent invocation."""
    plan = _multi_step_plan()
    captured = {}

    async def capture_ainvoke(*, input, config):
        captured["messages"] = input["messages"]
        return {"messages": [MagicMock(content="next result")]}

    mock_agent = AsyncMock()
    mock_agent.ainvoke.side_effect = capture_ainvoke

    await _execute_agent_step(
        {"current_plan": plan, "observations": []},
        mock_agent,
        "researcher",
    )

    combined = "\n".join(message.content for message in captured["messages"])
    assert "Existing Research Findings" in combined
    assert "prior finding content" in combined
    assert "Next step" in combined
    assert plan.steps[1].execution_res == "next result"


@pytest.mark.asyncio
async def test_execute_agent_step_no_unexecuted_step_returns_to_research_team():
    plan = _plan(executed=True)
    mock_agent = _mock_agent()

    result = await _execute_agent_step(
        {"current_plan": plan, "observations": []},
        mock_agent,
        "researcher",
    )

    assert result.goto == "research_team"
    assert result.update is None or result.update == {}
    mock_agent.ainvoke.assert_not_awaited()


@pytest.mark.asyncio
async def test_execute_agent_step_researcher_includes_resource_reminder():
    plan = _plan()
    resources = [Resource(uri="file://doc.pdf", title="Doc", description="A doc")]
    captured = {}

    async def capture_ainvoke(*, input, config):
        captured["messages"] = input["messages"]
        return {"messages": [MagicMock(content="ok")]}

    mock_agent = AsyncMock()
    mock_agent.ainvoke.side_effect = capture_ainvoke

    await _execute_agent_step(
        {"current_plan": plan, "resources": resources, "observations": []},
        mock_agent,
        "researcher",
    )

    assert any(
        "local_search_tool" in message.content for message in captured["messages"]
    )


@pytest.mark.asyncio
@pytest.mark.parametrize(
    "env_value,expected_limit",
    [
        ("10", 10),
        ("not-a-number", 25),
        ("0", 25),
        ("-3", 25),
    ],
)
async def test_execute_agent_step_recursion_limit_parsing(
    monkeypatch, env_value, expected_limit
):
    monkeypatch.setenv("AGENT_RECURSION_LIMIT", env_value)
    plan = _plan()
    captured = {}

    async def capture_ainvoke(*, input, config):
        captured["recursion_limit"] = config["recursion_limit"]
        return {"messages": [MagicMock(content="ok")]}

    mock_agent = AsyncMock()
    mock_agent.ainvoke.side_effect = capture_ainvoke

    await _execute_agent_step(
        {"current_plan": plan, "observations": []},
        mock_agent,
        "coder",
    )

    assert captured["recursion_limit"] == expected_limit


@pytest.mark.asyncio
async def test_researcher_node_builds_tools_and_executes_step(monkeypatch):
    web_search_tool = MagicMock(name="web_search")
    crawl = MagicMock(name="crawl")
    monkeypatch.setattr("src.graph.nodes.get_web_search_tool", lambda _: web_search_tool)
    monkeypatch.setattr("src.graph.nodes.crawl_tool", crawl)
    monkeypatch.setattr("src.graph.nodes.get_retriever_tool", lambda _: None)

    mock_agent = _mock_agent("research complete")
    captured = {}

    def capture_create_agent(agent_type, agent_type2, tools, prompt_template):
        captured["tools"] = tools
        return mock_agent

    monkeypatch.setattr("src.graph.nodes.create_agent", capture_create_agent)

    result = await researcher_node(
        {"current_plan": _plan(), "observations": []},
        _config(),
    )

    assert result.goto == "research_team"
    assert captured["tools"] == [web_search_tool, crawl]


@pytest.mark.asyncio
async def test_researcher_node_prepends_retriever_tool_when_resources_present(
    monkeypatch,
):
    retriever_tool = MagicMock(name="retriever")
    web_search_tool = MagicMock(name="web_search")
    crawl = MagicMock(name="crawl")
    monkeypatch.setattr("src.graph.nodes.get_retriever_tool", lambda _: retriever_tool)
    monkeypatch.setattr("src.graph.nodes.get_web_search_tool", lambda _: web_search_tool)
    monkeypatch.setattr("src.graph.nodes.crawl_tool", crawl)

    captured = {}

    def capture_create_agent(agent_type, agent_type2, tools, prompt_template):
        captured["tools"] = tools
        return _mock_agent("with retriever")

    monkeypatch.setattr("src.graph.nodes.create_agent", capture_create_agent)

    await researcher_node(
        {
            "current_plan": _plan(),
            "observations": [],
            "resources": [
                Resource(uri="file://notes.md", title="Notes", description="Notes")
            ],
        },
        _config(),
    )

    assert captured["tools"][0] is retriever_tool


@pytest.mark.asyncio
async def test_researcher_node_loads_mcp_tools_when_configured(monkeypatch):
    """MCP-enabled researcher must merge remote tools with default search/crawl tools."""
    web_search_tool = MagicMock(name="web_search")
    crawl = MagicMock(name="crawl")
    monkeypatch.setattr("src.graph.nodes.get_web_search_tool", lambda _: web_search_tool)
    monkeypatch.setattr("src.graph.nodes.crawl_tool", crawl)
    monkeypatch.setattr("src.graph.nodes.get_retriever_tool", lambda _: None)

    mcp_tool = MagicMock()
    mcp_tool.name = "mcp_search"
    mcp_tool.description = "MCP search"

    class MockMCPClient:
        def __init__(self, servers):
            self.servers = servers

        async def __aenter__(self):
            return self

        async def __aexit__(self, *args):
            return None

        def get_tools(self):
            return [mcp_tool]

    monkeypatch.setattr("src.graph.nodes.MultiServerMCPClient", MockMCPClient)

    captured = {}

    def capture_create_agent(agent_type, agent_type2, tools, prompt_template):
        captured["tools"] = tools
        return _mock_agent("mcp result")

    monkeypatch.setattr("src.graph.nodes.create_agent", capture_create_agent)

    result = await researcher_node(
        {"current_plan": _plan(), "observations": []},
        _mcp_config(agent_type="researcher"),
    )

    assert result.goto == "research_team"
    tool_names = [getattr(tool, "name", None) for tool in captured["tools"]]
    assert "mcp_search" in tool_names
    assert web_search_tool in captured["tools"]
    assert crawl in captured["tools"]
    assert mcp_tool.description.startswith("Powered by 'test_server'")


@pytest.mark.asyncio
async def test_coder_node_ignores_mcp_tools_for_other_agents(monkeypatch):
    """MCP servers scoped to researcher must not alter coder tool wiring."""
    python_repl = MagicMock(name="python_repl")
    monkeypatch.setattr("src.graph.nodes.python_repl_tool", python_repl)

    class FailMCPClient:
        def __init__(self, servers):
            raise AssertionError("coder must not open MCP client for researcher-only servers")

    monkeypatch.setattr("src.graph.nodes.MultiServerMCPClient", FailMCPClient)

    captured = {}

    def capture_create_agent(agent_type, agent_type2, tools, prompt_template):
        captured["tools"] = tools
        return _mock_agent("code output")

    monkeypatch.setattr("src.graph.nodes.create_agent", capture_create_agent)

    result = await coder_node(
        {"current_plan": _plan(), "observations": []},
        _mcp_config(agent_type="researcher"),
    )

    assert result.goto == "research_team"
    assert captured["tools"] == [python_repl]


@pytest.mark.asyncio
async def test_coder_node_uses_python_repl_tool(monkeypatch):
    python_repl = MagicMock(name="python_repl")
    monkeypatch.setattr("src.graph.nodes.python_repl_tool", python_repl)

    captured = {}

    def capture_create_agent(agent_type, agent_type2, tools, prompt_template):
        captured["tools"] = tools
        return _mock_agent("code output")

    monkeypatch.setattr("src.graph.nodes.create_agent", capture_create_agent)

    result = await coder_node(
        {"current_plan": _plan(), "observations": []},
        _config(),
    )

    assert result.goto == "research_team"
    assert captured["tools"] == [python_repl]
