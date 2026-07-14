# Copyright (c) 2025 YADRA

"""Regression tests for legacy chat stream workflow in app.py."""

import json
from types import SimpleNamespace
from unittest.mock import MagicMock

import pytest
from langchain_core.messages import AIMessageChunk, ToolMessage
from langgraph.types import Command

from src.config.report_style import ReportStyle
from src.server.app import _astream_workflow_generator, _make_event


def _parse_sse(event_str: str) -> tuple[str, dict]:
    lines = event_str.strip().split("\n")
    event_type = lines[0].split(": ", 1)[1]
    data = json.loads(lines[1].split(": ", 1)[1])
    return event_type, data


def _workflow_kwargs(**overrides):
    data = {
        "messages": [{"role": "user", "content": "refined question"}],
        "thread_id": "thread-abc",
        "resources": [],
        "max_plan_iterations": 3,
        "max_step_num": 5,
        "max_search_results": 5,
        "auto_accepted_plan": False,
        "interrupt_feedback": "accepted",
        "mcp_settings": {},
        "enable_background_investigation": False,
        "report_style": ReportStyle.NEWS,
        "enable_deep_thinking": False,
    }
    data.update(overrides)
    return data


def _empty_astream(captured):
    async def _astream(input_, config, **kwargs):
        captured["input"] = input_
        captured["config"] = config
        if False:
            yield None

    return _astream


@pytest.mark.asyncio
async def test_make_event_strips_empty_content():
    event = _make_event("message_chunk", {"content": "", "thread_id": "t1"})
    event_type, data = _parse_sse(event)
    assert event_type == "message_chunk"
    assert "content" not in data
    assert data["thread_id"] == "t1"


@pytest.mark.asyncio
async def test_workflow_generator_uses_command_resume_for_hitl_feedback():
    """HITL chat stream must resume LangGraph via Command, aligned with research_stream_api."""
    captured = {}
    mock_graph = MagicMock()
    mock_graph.astream = _empty_astream(captured)

    events = [
        event
        async for event in _astream_workflow_generator(
            mock_graph, **_workflow_kwargs()
        )
    ]

    assert isinstance(captured["input"], Command)
    assert captured["input"].resume == "[accepted] refined question"
    assert events[-1].startswith("event: done")


@pytest.mark.asyncio
async def test_workflow_generator_hitl_feedback_without_message():
    captured = {}
    mock_graph = MagicMock()
    mock_graph.astream = _empty_astream(captured)

    async for _ in _astream_workflow_generator(
        mock_graph,
        **_workflow_kwargs(
            messages=[],
            interrupt_feedback="skip_research",
        ),
    ):
        pass

    assert captured["input"].resume == "[skip_research]"


@pytest.mark.asyncio
async def test_workflow_generator_auto_accepted_plan_ignores_interrupt_feedback():
    captured = {}
    mock_graph = MagicMock()
    mock_graph.astream = _empty_astream(captured)

    async for _ in _astream_workflow_generator(
        mock_graph,
        **_workflow_kwargs(
            auto_accepted_plan=True,
            interrupt_feedback="accepted",
        ),
    ):
        pass

    assert not isinstance(captured["input"], Command)
    assert captured["input"]["auto_accepted_plan"] is True


@pytest.mark.asyncio
async def test_workflow_generator_without_hitl_uses_plain_state():
    captured = {}
    mock_graph = MagicMock()
    mock_graph.astream = _empty_astream(captured)

    async for _ in _astream_workflow_generator(
        mock_graph,
        **_workflow_kwargs(interrupt_feedback=""),
    ):
        pass

    assert not isinstance(captured["input"], Command)
    assert captured["input"]["research_topic"] == "refined question"


@pytest.mark.asyncio
async def test_workflow_generator_emits_standard_interrupt_event():
    interrupt_value = {
        "message": "Please review the plan.",
        "options": [{"text": "Start research", "value": "accepted"}],
    }
    interrupt_data = SimpleNamespace(value=interrupt_value, ns=["interrupt-node"])

    async def interrupt_astream(*_args, **_kwargs):
        yield (("planner:node",), None, {"__interrupt__": [interrupt_data]})

    mock_graph = MagicMock()
    mock_graph.astream = interrupt_astream

    events = [
        event
        async for event in _astream_workflow_generator(
            mock_graph, **_workflow_kwargs(interrupt_feedback="")
        )
    ]

    interrupt = next(
        _parse_sse(event) for event in events if event.startswith("event: interrupt")
    )
    event_type, payload = interrupt
    assert event_type == "interrupt"
    assert payload["content"] == "Please review the plan."
    assert payload["finish_reason"] == "interrupt"
    assert payload["options"] == interrupt_value["options"]


@pytest.mark.asyncio
async def test_workflow_generator_emits_reask_interrupt_event():
    interrupt_data = SimpleNamespace(
        value=("reask", {"text": "original question"}),
        ns=["reask-node"],
    )

    async def reask_astream(*_args, **_kwargs):
        yield (("planner:node",), None, {"__interrupt__": [interrupt_data]})

    mock_graph = MagicMock()
    mock_graph.astream = reask_astream

    events = [
        event
        async for event in _astream_workflow_generator(
            mock_graph, **_workflow_kwargs(interrupt_feedback="")
        )
    ]

    reask = next(
        _parse_sse(event) for event in events if event.startswith("event: reask")
    )
    event_type, payload = reask
    assert event_type == "reask"
    assert payload["finish_reason"] == "reask"
    assert payload["original_input"] == {"text": "original question"}


@pytest.mark.asyncio
async def test_workflow_generator_emits_message_chunk_for_ai_tokens():
    message = AIMessageChunk(content="Hello", id="msg-1")

    async def message_astream(*_args, **_kwargs):
        yield (("writer:node",), None, (message, {}))

    mock_graph = MagicMock()
    mock_graph.astream = message_astream

    events = [
        event
        async for event in _astream_workflow_generator(
            mock_graph, **_workflow_kwargs(interrupt_feedback="")
        )
    ]

    chunk = next(
        _parse_sse(event) for event in events if event.startswith("event: message_chunk")
    )
    _, payload = chunk
    assert payload["content"] == "Hello"
    assert payload["agent"] == "writer"


@pytest.mark.asyncio
async def test_workflow_generator_emits_tool_call_result_event():
    message = ToolMessage(content="search results", id="tool-1", tool_call_id="call-1")

    async def tool_astream(*_args, **_kwargs):
        yield (("researcher:tool",), None, (message, {}))

    mock_graph = MagicMock()
    mock_graph.astream = tool_astream

    events = [
        event
        async for event in _astream_workflow_generator(
            mock_graph, **_workflow_kwargs(interrupt_feedback="")
        )
    ]

    result = next(
        _parse_sse(event)
        for event in events
        if event.startswith("event: tool_call_result")
    )
    _, payload = result
    assert payload["content"] == "search results"
    assert payload["tool_call_id"] == "call-1"


@pytest.mark.asyncio
async def test_workflow_generator_legacy_interrupt_uses_default_options():
    """Non-dict interrupt payloads must emit default HITL options in legacy chat stream."""
    interrupt_data = SimpleNamespace(
        value="legacy interrupt payload",
        ns=["legacy-node"],
    )

    async def legacy_interrupt_astream(*_args, **_kwargs):
        yield (("planner:node",), None, {"__interrupt__": [interrupt_data]})

    mock_graph = MagicMock()
    mock_graph.astream = legacy_interrupt_astream

    events = [
        event
        async for event in _astream_workflow_generator(
            mock_graph, **_workflow_kwargs(interrupt_feedback="")
        )
    ]

    interrupt = next(
        _parse_sse(event) for event in events if event.startswith("event: interrupt")
    )
    _, payload = interrupt
    assert payload["content"] == "legacy interrupt payload"
    option_values = {opt["value"] for opt in payload["options"]}
    assert option_values == {"accepted", "edit_plan", "skip_research", "cancel"}


@pytest.mark.asyncio
async def test_workflow_generator_message_chunk_includes_reasoning_metadata():
    message = AIMessageChunk(
        content="final answer",
        id="msg-reason",
        additional_kwargs={"reasoning_content": "internal reasoning"},
        response_metadata={"finish_reason": "stop"},
    )

    async def reasoning_astream(*_args, **_kwargs):
        yield (("writer:node",), None, (message, {}))

    mock_graph = MagicMock()
    mock_graph.astream = reasoning_astream

    events = [
        event
        async for event in _astream_workflow_generator(
            mock_graph, **_workflow_kwargs(interrupt_feedback="")
        )
    ]

    chunk = next(
        _parse_sse(event) for event in events if event.startswith("event: message_chunk")
    )
    _, payload = chunk
    assert payload["reasoning_content"] == "internal reasoning"
    assert payload["finish_reason"] == "stop"


@pytest.mark.asyncio
async def test_workflow_generator_emits_tool_calls_event():
    message = AIMessageChunk(
        content="",
        id="msg-tool",
        tool_calls=[{"name": "web_search", "args": {"query": "AI"}, "id": "call-1"}],
    )

    async def tool_calls_astream(*_args, **_kwargs):
        yield (("researcher:node",), None, (message, {}))

    mock_graph = MagicMock()
    mock_graph.astream = tool_calls_astream

    events = [
        event
        async for event in _astream_workflow_generator(
            mock_graph, **_workflow_kwargs(interrupt_feedback="")
        )
    ]

    tool_calls = next(
        _parse_sse(event) for event in events if event.startswith("event: tool_calls")
    )
    _, payload = tool_calls
    assert payload["tool_calls"][0]["name"] == "web_search"
    assert payload["agent"] == "researcher"


@pytest.mark.asyncio
async def test_workflow_generator_emits_tool_call_chunks_event():
    message = AIMessageChunk.model_construct(
        content="",
        id="msg-chunks",
        tool_calls=[],
        tool_call_chunks=[
            {"name": "web_search", "args": '{"query": "AI"}', "index": 0, "id": "call-1"}
        ],
        additional_kwargs={},
        response_metadata={},
    )

    async def tool_call_chunks_astream(*_args, **_kwargs):
        yield (("researcher:node",), None, (message, {}))

    mock_graph = MagicMock()
    mock_graph.astream = tool_call_chunks_astream

    events = [
        event
        async for event in _astream_workflow_generator(
            mock_graph, **_workflow_kwargs(interrupt_feedback="")
        )
    ]

    chunks = next(
        _parse_sse(event)
        for event in events
        if event.startswith("event: tool_call_chunks")
    )
    _, payload = chunks
    assert payload["tool_call_chunks"][0]["name"] == "web_search"
