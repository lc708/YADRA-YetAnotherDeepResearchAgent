# Copyright (c) 2025 YADRA

import json
from types import SimpleNamespace
from unittest.mock import AsyncMock, MagicMock

import pytest
from langchain_core.messages import AIMessageChunk, ToolMessage

from src.server.research_stream_api import (
    ActionType,
    ResearchStreamRequest,
    ResearchStreamService,
)


def _stream_request(**overrides):
    data = {
        "action": ActionType.CREATE,
        "message": "test question",
        "frontend_uuid": "uuid-1",
        "frontend_context_uuid": "ctx-1",
        "visitor_id": "visitor-1",
        "config": {
            "auto_accepted_plan": True,
            "reportStyle": "news",
            "maxPlanIterations": 4,
            "maxStepNum": 6,
            "maxSearchResults": 8,
            "enableDeepThinking": True,
            "enableBackgroundInvestigation": False,
        },
    }
    data.update(overrides)
    return ResearchStreamRequest(**data)


async def _interrupt_astream(interrupt_payload):
    yield ("agent:node", None, interrupt_payload)
    if False:
        yield None


@pytest.mark.asyncio
async def test_process_langgraph_stream_raises_when_session_missing():
    session_repo = MagicMock()
    session_repo.get_session_by_thread_id = AsyncMock(return_value=None)
    service = ResearchStreamService(session_repo)

    with pytest.raises(ValueError, match="Session not found"):
        async for _ in service._process_langgraph_stream(
            MagicMock(),
            {},
            "missing-thread",
            "exec-1",
            _stream_request(),
        ):
            pass


@pytest.mark.asyncio
async def test_process_langgraph_stream_uses_flattened_config_fallback():
    """When research_config key is absent, flattened keys must drive LangGraph config."""
    session_repo = MagicMock()
    session_repo.get_session_by_thread_id = AsyncMock(
        return_value=MagicMock(id=1, thread_id="thread-1")
    )

    captured = {}

    async def capture_astream(initial_state, config, **kwargs):
        captured["config"] = config
        if False:
            yield None

    mock_graph = MagicMock()
    mock_graph.astream = capture_astream
    mock_graph.aget_state = AsyncMock(return_value=MagicMock())

    service = ResearchStreamService(session_repo)
    events = [
        event
        async for event in service._process_langgraph_stream(
            mock_graph, {}, "thread-1", "exec-1", _stream_request()
        )
    ]

    assert any(event["event"] == "metadata" for event in events)
    configurable = captured["config"]["configurable"]
    assert configurable["max_plan_iterations"] == 4
    assert configurable["max_step_num"] == 6
    assert configurable["max_search_results"] == 8
    assert configurable["report_style"] == "news"
    assert configurable["enable_deep_thinking"] is True


@pytest.mark.asyncio
async def test_process_langgraph_stream_emits_standard_interrupt_event():
    interrupt_value = {
        "message": "Please review the plan.",
        "options": [
            {"text": "开始研究", "value": "accepted"},
            {"text": "编辑计划", "value": "edit_plan"},
        ],
    }
    interrupt_data = SimpleNamespace(
        value=interrupt_value,
        ns=["interrupt-node"],
    )

    session_repo = MagicMock()
    session_repo.get_session_by_thread_id = AsyncMock(
        return_value=MagicMock(id=1, thread_id="thread-1")
    )

    mock_graph = MagicMock()
    mock_graph.astream = lambda *args, **kwargs: _interrupt_astream(
        {"__interrupt__": [interrupt_data]}
    )

    service = ResearchStreamService(session_repo)
    events = [
        event
        async for event in service._process_langgraph_stream(
            mock_graph, {}, "thread-1", "exec-1", _stream_request()
        )
    ]

    interrupt = next(event for event in events if event["event"] == "interrupt")
    payload = json.loads(interrupt["data"])
    assert payload["content"] == "Please review the plan."
    assert payload["finish_reason"] == "interrupt"
    assert payload["options"] == interrupt_value["options"]
    assert payload["id"] == "interrupt-node"


@pytest.mark.asyncio
async def test_process_langgraph_stream_emits_reask_interrupt_event():
    interrupt_data = SimpleNamespace(
        value=("reask", "original user question"),
        ns=["reask-node"],
    )

    session_repo = MagicMock()
    session_repo.get_session_by_thread_id = AsyncMock(
        return_value=MagicMock(id=1, thread_id="thread-1")
    )

    mock_graph = MagicMock()
    mock_graph.astream = lambda *args, **kwargs: _interrupt_astream(
        {"__interrupt__": [interrupt_data]}
    )

    service = ResearchStreamService(session_repo)
    events = [
        event
        async for event in service._process_langgraph_stream(
            mock_graph, {}, "thread-1", "exec-1", _stream_request()
        )
    ]

    reask = next(event for event in events if event["event"] == "reask")
    payload = json.loads(reask["data"])
    assert payload["finish_reason"] == "reask"
    assert payload["original_input"] == "original user question"


@pytest.mark.asyncio
async def test_process_langgraph_stream_emits_message_chunk_for_ai_tokens():
    message = AIMessageChunk(content="Hello", id="msg-1")

    async def message_astream(*_args, **_kwargs):
        yield (("writer:node",), None, (message, {}))

    session_repo = MagicMock()
    session_repo.get_session_by_thread_id = AsyncMock(
        return_value=MagicMock(id=1, thread_id="thread-1")
    )

    mock_graph = MagicMock()
    mock_graph.astream = message_astream
    mock_graph.aget_state = AsyncMock(return_value=MagicMock())

    service = ResearchStreamService(session_repo)
    events = [
        event
        async for event in service._process_langgraph_stream(
            mock_graph, {}, "thread-1", "exec-1", _stream_request()
        )
    ]

    chunk = next(event for event in events if event["event"] == "message_chunk")
    payload = json.loads(chunk["data"])
    assert payload["content"] == "Hello"
    assert payload["agent"] == "writer"


@pytest.mark.asyncio
async def test_process_langgraph_stream_emits_tool_call_result_event():
    message = ToolMessage(content="search results", id="tool-1", tool_call_id="call-1")

    async def tool_astream(*_args, **_kwargs):
        yield (("researcher:tool",), None, (message, {}))

    session_repo = MagicMock()
    session_repo.get_session_by_thread_id = AsyncMock(
        return_value=MagicMock(id=1, thread_id="thread-1")
    )

    mock_graph = MagicMock()
    mock_graph.astream = tool_astream
    mock_graph.aget_state = AsyncMock(return_value=MagicMock())

    service = ResearchStreamService(session_repo)
    events = [
        event
        async for event in service._process_langgraph_stream(
            mock_graph, {}, "thread-1", "exec-1", _stream_request()
        )
    ]

    result = next(event for event in events if event["event"] == "tool_call_result")
    payload = json.loads(result["data"])
    assert payload["content"] == "search results"
    assert payload["tool_call_id"] == "call-1"


@pytest.mark.asyncio
async def test_process_langgraph_stream_emits_tool_calls_event():
    message = AIMessageChunk(
        content="",
        id="msg-tool",
        tool_calls=[{"name": "web_search", "args": {"query": "AI"}, "id": "call-1"}],
    )

    async def tool_calls_astream(*_args, **_kwargs):
        yield (("researcher:node",), None, (message, {}))

    session_repo = MagicMock()
    session_repo.get_session_by_thread_id = AsyncMock(
        return_value=MagicMock(id=1, thread_id="thread-1")
    )

    mock_graph = MagicMock()
    mock_graph.astream = tool_calls_astream
    mock_graph.aget_state = AsyncMock(return_value=MagicMock())

    service = ResearchStreamService(session_repo)
    events = [
        event
        async for event in service._process_langgraph_stream(
            mock_graph, {}, "thread-1", "exec-1", _stream_request()
        )
    ]

    tool_calls = next(event for event in events if event["event"] == "tool_calls")
    payload = json.loads(tool_calls["data"])
    assert payload["tool_calls"][0]["name"] == "web_search"
    assert payload["agent"] == "researcher"


@pytest.mark.asyncio
async def test_process_langgraph_stream_emits_tool_call_chunks_event():
    message = AIMessageChunk.model_construct(
        content="",
        id="msg-chunk",
        tool_calls=[],
        tool_call_chunks=[
            {"name": "web_search", "args": "", "index": 0, "id": "call-1"}
        ],
        additional_kwargs={},
        response_metadata={},
    )

    async def chunk_astream(*_args, **_kwargs):
        yield (("researcher:node",), None, (message, {}))

    session_repo = MagicMock()
    session_repo.get_session_by_thread_id = AsyncMock(
        return_value=MagicMock(id=1, thread_id="thread-1")
    )

    mock_graph = MagicMock()
    mock_graph.astream = chunk_astream
    mock_graph.aget_state = AsyncMock(return_value=MagicMock())

    service = ResearchStreamService(session_repo)
    events = [
        event
        async for event in service._process_langgraph_stream(
            mock_graph, {}, "thread-1", "exec-1", _stream_request()
        )
    ]

    chunks = next(event for event in events if event["event"] == "tool_call_chunks")
    payload = json.loads(chunks["data"])
    assert payload["tool_call_chunks"][0]["name"] == "web_search"


@pytest.mark.asyncio
async def test_process_langgraph_stream_message_chunk_includes_reasoning_metadata():
    message = AIMessageChunk(
        content="final answer",
        id="msg-reason",
        additional_kwargs={"reasoning_content": "internal reasoning"},
        response_metadata={"finish_reason": "stop"},
    )

    async def reasoning_astream(*_args, **_kwargs):
        yield (("writer:node",), None, (message, {}))

    session_repo = MagicMock()
    session_repo.get_session_by_thread_id = AsyncMock(
        return_value=MagicMock(id=1, thread_id="thread-1")
    )

    mock_graph = MagicMock()
    mock_graph.astream = reasoning_astream
    mock_graph.aget_state = AsyncMock(return_value=MagicMock())

    service = ResearchStreamService(session_repo)
    events = [
        event
        async for event in service._process_langgraph_stream(
            mock_graph, {}, "thread-1", "exec-1", _stream_request()
        )
    ]

    chunk = next(event for event in events if event["event"] == "message_chunk")
    payload = json.loads(chunk["data"])
    assert payload["reasoning_content"] == "internal reasoning"
    assert payload["finish_reason"] == "stop"


@pytest.mark.asyncio
async def test_process_langgraph_stream_legacy_interrupt_uses_default_options():
    """Non-dict interrupt payloads must still emit actionable default HITL options."""
    interrupt_data = SimpleNamespace(
        value="legacy interrupt payload",
        ns=["legacy-node"],
    )

    session_repo = MagicMock()
    session_repo.get_session_by_thread_id = AsyncMock(
        return_value=MagicMock(id=1, thread_id="thread-1")
    )

    mock_graph = MagicMock()
    mock_graph.astream = lambda *args, **kwargs: _interrupt_astream(
        {"__interrupt__": [interrupt_data]}
    )

    service = ResearchStreamService(session_repo)
    events = [
        event
        async for event in service._process_langgraph_stream(
            mock_graph, {}, "thread-1", "exec-1", _stream_request()
        )
    ]

    interrupt = next(event for event in events if event["event"] == "interrupt")
    payload = json.loads(interrupt["data"])
    assert payload["content"] == "legacy interrupt payload"
    option_values = {opt["value"] for opt in payload["options"]}
    assert option_values == {"accepted", "edit_plan", "skip_research", "reask"}


@pytest.mark.asyncio
async def test_process_langgraph_stream_emits_complete_event_on_success():
    async def empty_astream(*_args, **_kwargs):
        if False:
            yield None

    session_repo = MagicMock()
    session_repo.get_session_by_thread_id = AsyncMock(
        return_value=MagicMock(id=1, thread_id="thread-1")
    )

    mock_graph = MagicMock()
    mock_graph.astream = empty_astream
    mock_graph.aget_state = AsyncMock(return_value=MagicMock())

    service = ResearchStreamService(session_repo)
    events = [
        event
        async for event in service._process_langgraph_stream(
            mock_graph, {}, "thread-1", "exec-1", _stream_request()
        )
    ]

    complete = next(event for event in events if event["event"] == "complete")
    payload = json.loads(complete["data"])
    assert payload["final_status"] == "completed"
    assert payload["execution_id"] == "exec-1"
    assert payload["thread_id"] == "thread-1"


@pytest.mark.asyncio
async def test_process_langgraph_stream_emits_error_on_graph_failure():
    async def failing_astream(*_args, **_kwargs):
        raise RuntimeError("graph execution failed")
        if False:
            yield None

    session_repo = MagicMock()
    session_repo.get_session_by_thread_id = AsyncMock(
        return_value=MagicMock(id=1, thread_id="thread-1")
    )

    mock_graph = MagicMock()
    mock_graph.astream = failing_astream

    service = ResearchStreamService(session_repo)
    events = [
        event
        async for event in service._process_langgraph_stream(
            mock_graph, {}, "thread-1", "exec-1", _stream_request()
        )
    ]

    error = next(event for event in events if event["event"] == "error")
    payload = json.loads(error["data"])
    assert payload["error_code"] == "LANGGRAPH_EXECUTION_ERROR"
    assert "graph execution failed" in payload["error_message"]
