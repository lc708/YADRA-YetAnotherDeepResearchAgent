# Copyright (c) 2025 YADRA

import json
from unittest.mock import AsyncMock, MagicMock

import pytest
from fastapi import HTTPException

from src.server.research_create_api import ResearchAskRequest, ResearchAskService


def _service():
    return ResearchAskService(session_repo=MagicMock())


def test_parse_config_uses_nested_research_overrides():
    research, model, output = _service()._parse_config(
        {
            "research": {
                "auto_accepted_plan": True,
                "max_research_depth": 7,
                "max_step_num": 9,
                "max_search_results": 11,
                "report_style": "news",
            },
            "model": {"model_name": "claude-haiku-4-5", "provider": "anthropic"},
            "output": {"language": "en", "output_format": "html"},
        }
    )
    assert research["auto_accepted_plan"] is True
    assert research["max_plan_iterations"] == 7
    assert research["max_step_num"] == 9
    assert research["max_search_results"] == 11
    assert research["report_style"] == "news"
    assert model["model_name"] == "claude-haiku-4-5"
    assert output["language"] == "en"


def test_parse_config_falls_back_to_flat_keys_and_defaults():
    research, model, output = _service()._parse_config(
        {
            "auto_accepted_plan": True,
            "max_plan_iterations": 4,
            "max_step_num": 6,
            "max_search_results": 8,
            "report_style": "casual",
        }
    )
    assert research["auto_accepted_plan"] is True
    assert research["enable_background_investigation"] is True
    assert research["max_plan_iterations"] == 4
    assert research["max_step_num"] == 6
    assert research["max_search_results"] == 8
    assert research["report_style"] == "casual"
    assert model == {}
    assert output == {"language": "zh-CN", "output_format": "markdown"}


def test_parse_config_nested_research_depth_overrides_flat_iterations():
    research, _, _ = _service()._parse_config(
        {
            "research": {"max_research_depth": 2},
            "max_plan_iterations": 99,
        }
    )
    assert research["max_plan_iterations"] == 2


def test_parse_config_explicit_false_background_investigation_uses_or_chain():
    """Documents current or-chain behavior: explicit False is treated as missing and defaults to True."""
    research, _, _ = _service()._parse_config(
        {"research": {"enable_background_investigation": False}}
    )
    assert research["enable_background_investigation"] is True


def test_build_stream_config_flattens_nested_research_settings():
    stream_config = _service()._build_stream_config(
        {
            "research": {
                "auto_accepted_plan": True,
                "max_research_depth": 4,
                "max_step_num": 7,
                "max_search_results": 9,
                "report_style": "news",
                "enable_deep_thinking": True,
            },
            "output": {"output_format": "html"},
            "interrupt_feedback": "accepted",
        }
    )
    assert stream_config["auto_accepted_plan"] is True
    assert stream_config["enableBackgroundInvestigation"] is True
    assert stream_config["reportStyle"] == "news"
    assert stream_config["enableDeepThinking"] is True
    assert stream_config["maxPlanIterations"] == 4
    assert stream_config["maxStepNum"] == 7
    assert stream_config["maxSearchResults"] == 9
    assert stream_config["outputFormat"] == "html"
    assert stream_config["interrupt_feedback"] == "accepted"
    assert stream_config["research_config"]["max_plan_iterations"] == 4


def test_estimate_research_duration_base_case():
    assert _service()._estimate_research_duration("short question") == 60


def test_estimate_research_duration_scales_with_length_and_keywords():
    long_question = "x" * 150 + "深入分析比较"
    duration = _service()._estimate_research_duration(long_question)
    # 60 base + 30 (len>100) + 20 each for 深入/分析/比较
    assert duration == 150


def test_estimate_research_duration_never_exceeds_cap():
    question = "分析比较研究评估调查深入全面" + "x" * 250
    duration = _service()._estimate_research_duration(question)
    assert duration == 260  # 60 + 30 + 30 + 7 keywords × 20
    assert duration <= 300


def _followup_request(**overrides):
    data = {
        "question": "Follow-up question",
        "ask_type": "followup",
        "frontend_uuid": "uuid-1",
        "visitor_id": "visitor-1",
        "session_id": 42,
        "thread_id": "thread-abc",
        "url_param": "test-slug",
    }
    data.update(overrides)
    return ResearchAskRequest(**data)


@pytest.mark.asyncio
async def test_handle_followup_ask_rejects_missing_required_fields():
    service = _service()
    request = _followup_request(session_id=None)

    with pytest.raises(HTTPException) as exc:
        await service._handle_followup_ask(request)

    assert exc.value.status_code == 400
    assert "session_id, thread_id, url_param" in exc.value.detail


@pytest.mark.asyncio
async def test_handle_followup_ask_rejects_unknown_session():
    session_repo = MagicMock()
    session_repo.get_session_overview = AsyncMock(return_value=None)
    service = ResearchAskService(session_repo=session_repo)

    with pytest.raises(HTTPException) as exc:
        await service._handle_followup_ask(_followup_request())

    assert exc.value.status_code == 404
    assert exc.value.detail == "会话不存在"


@pytest.mark.asyncio
async def test_handle_followup_ask_rejects_session_id_mismatch():
    session_repo = MagicMock()
    session_repo.get_session_overview = AsyncMock(
        return_value={"id": 99, "thread_id": "thread-abc"}
    )
    service = ResearchAskService(session_repo=session_repo)

    with pytest.raises(HTTPException) as exc:
        await service._handle_followup_ask(_followup_request(session_id=42))

    assert exc.value.status_code == 400
    assert exc.value.detail == "session_id不匹配"


@pytest.mark.asyncio
async def test_handle_followup_ask_rejects_thread_id_mismatch():
    session_repo = MagicMock()
    session_repo.get_session_overview = AsyncMock(
        return_value={"id": 42, "thread_id": "other-thread"}
    )
    service = ResearchAskService(session_repo=session_repo)

    with pytest.raises(HTTPException) as exc:
        await service._handle_followup_ask(_followup_request())

    assert exc.value.status_code == 400
    assert exc.value.detail == "thread_id不匹配"


@pytest.mark.asyncio
async def test_prepare_followup_session_rejects_missing_session_data():
    session_repo = MagicMock()
    session_repo.get_session_overview = AsyncMock(
        return_value={"id": 42, "thread_id": "thread-abc"}
    )
    session_repo.get_session_by_thread_id = AsyncMock(return_value=None)
    service = ResearchAskService(session_repo=session_repo)

    with pytest.raises(HTTPException) as exc:
        await service._prepare_followup_session(_followup_request())

    assert exc.value.status_code == 404
    assert exc.value.detail == "Session数据不存在"


@pytest.mark.asyncio
async def test_prepare_followup_session_returns_session_when_valid():
    session_repo = MagicMock()
    session_repo.get_session_overview = AsyncMock(
        return_value={"id": 42, "thread_id": "thread-abc"}
    )
    session_data = MagicMock(id=42, thread_id="thread-abc")
    session_repo.get_session_by_thread_id = AsyncMock(return_value=session_data)
    service = ResearchAskService(session_repo=session_repo)

    data, thread_id, url_param = await service._prepare_followup_session(
        _followup_request()
    )

    assert data is session_data
    assert thread_id == "thread-abc"
    assert url_param == "test-slug"


@pytest.mark.asyncio
async def test_prepare_followup_session_rejects_missing_required_fields():
    service = _service()
    with pytest.raises(HTTPException) as exc:
        await service._prepare_followup_session(_followup_request(session_id=None))

    assert exc.value.status_code == 400
    assert "session_id, thread_id, url_param" in exc.value.detail


@pytest.mark.asyncio
async def test_prepare_followup_session_rejects_unknown_session():
    session_repo = MagicMock()
    session_repo.get_session_overview = AsyncMock(return_value=None)
    service = ResearchAskService(session_repo=session_repo)

    with pytest.raises(HTTPException) as exc:
        await service._prepare_followup_session(_followup_request())

    assert exc.value.status_code == 404
    assert exc.value.detail == "会话不存在"


@pytest.mark.asyncio
async def test_prepare_followup_session_rejects_session_id_mismatch():
    session_repo = MagicMock()
    session_repo.get_session_overview = AsyncMock(
        return_value={"id": 99, "thread_id": "thread-abc"}
    )
    service = ResearchAskService(session_repo=session_repo)

    with pytest.raises(HTTPException) as exc:
        await service._prepare_followup_session(_followup_request(session_id=42))

    assert exc.value.status_code == 400
    assert exc.value.detail == "session_id不匹配"


@pytest.mark.asyncio
async def test_prepare_followup_session_rejects_thread_id_mismatch():
    session_repo = MagicMock()
    session_repo.get_session_overview = AsyncMock(
        return_value={"id": 42, "thread_id": "other-thread"}
    )
    service = ResearchAskService(session_repo=session_repo)

    with pytest.raises(HTTPException) as exc:
        await service._prepare_followup_session(_followup_request())

    assert exc.value.status_code == 400
    assert exc.value.detail == "thread_id不匹配"


@pytest.mark.asyncio
async def test_handle_stream_ask_emits_error_event_on_prepare_failure():
    """Stream path must surface prepare failures as SSE error events, not hang."""
    service = _service()
    service._prepare_followup_session = AsyncMock(
        side_effect=HTTPException(status_code=404, detail="会话不存在")
    )

    chunks = [
        chunk
        async for chunk in service._handle_stream_ask(_followup_request())
    ]

    assert any("event: error" in chunk for chunk in chunks)
    data_chunks = [chunk for chunk in chunks if chunk.startswith("data: ")]
    assert data_chunks
    payload = json.loads(data_chunks[-1].split("data: ", 1)[1].strip())
    assert payload["error_code"] == "STREAM_ERROR"
    assert "会话不存在" in payload["error_message"]


@pytest.mark.asyncio
async def test_handle_stream_ask_followup_forwards_interrupt_feedback(monkeypatch):
    """Stream followup must pass interrupt_feedback into continue_research_stream context."""
    session_data = MagicMock(id=42, thread_id="thread-abc")
    service = ResearchAskService(session_repo=MagicMock())
    service._prepare_followup_session = AsyncMock(
        return_value=(session_data, "thread-abc", "test-slug")
    )

    captured = {}

    async def fake_continue(stream_request):
        captured["request"] = stream_request
        yield {"event": "complete", "data": "{}"}

    mock_stream_service = MagicMock()
    mock_stream_service.continue_research_stream = fake_continue
    monkeypatch.setattr(
        "src.server.research_stream_api.ResearchStreamService",
        MagicMock(return_value=mock_stream_service),
    )
    monkeypatch.setattr(
        "src.server.research_create_api.get_session_repository",
        MagicMock(return_value=MagicMock()),
    )

    request = ResearchAskRequest(
        question="",
        ask_type="followup",
        frontend_uuid="uuid-1",
        visitor_id="visitor-1",
        session_id=42,
        thread_id="thread-abc",
        url_param="test-slug",
        interrupt_feedback="edit_plan",
        config={},
    )

    chunks = [chunk async for chunk in service._handle_stream_ask(request)]

    assert any("event: navigation" in chunk for chunk in chunks)
    assert captured["request"].context == {"interrupt_feedback": "edit_plan"}
    assert captured["request"].action.value == "continue"


@pytest.mark.asyncio
async def test_handle_stream_ask_logs_when_error_event_yield_fails(monkeypatch):
    """If the client disconnects while emitting STREAM_ERROR, the handler must not crash."""
    session_data = MagicMock(id=1, thread_id="thread-1")
    service = ResearchAskService(session_repo=MagicMock())
    service._create_initial_session = AsyncMock(
        return_value=(session_data, "thread-1", "slug-1")
    )

    async def exploding_create_stream(*_args, **_kwargs):
        raise RuntimeError("stream backend unavailable")
        yield  # pragma: no cover

    mock_stream_service = MagicMock()
    mock_stream_service.create_research_stream = exploding_create_stream
    monkeypatch.setattr(
        "src.server.research_stream_api.ResearchStreamService",
        MagicMock(return_value=mock_stream_service),
    )
    monkeypatch.setattr(
        "src.server.research_create_api.get_session_repository",
        MagicMock(return_value=MagicMock()),
    )

    logged_errors = []
    monkeypatch.setattr(
        "src.server.research_create_api.logger.error",
        lambda message, **kwargs: logged_errors.append(message),
    )

    gen = service._handle_stream_ask(_initial_request())
    try:
        async for chunk in gen:
            if chunk.startswith("event: error"):
                await gen.athrow(GeneratorExit())
    except (StopAsyncIteration, GeneratorExit):
        pass

    assert any("Failed to send error event" in message for message in logged_errors)


@pytest.mark.asyncio
async def test_handle_stream_ask_initial_emits_navigation_and_starts_create_stream(
    monkeypatch,
):
    """Initial stream ask must pre-create session, emit navigation, then start create stream."""
    session_data = MagicMock(id=1, thread_id="thread-1")
    service = ResearchAskService(session_repo=MagicMock())
    service._create_initial_session = AsyncMock(
        return_value=(session_data, "thread-1", "slug-1")
    )

    captured = {}

    async def fake_create(stream_request, existing_session_id=None, existing_thread_id=None):
        captured["request"] = stream_request
        captured["existing_session_id"] = existing_session_id
        captured["existing_thread_id"] = existing_thread_id
        yield {"event": "metadata", "data": "{}"}

    mock_stream_service = MagicMock()
    mock_stream_service.create_research_stream = fake_create
    monkeypatch.setattr(
        "src.server.research_stream_api.ResearchStreamService",
        MagicMock(return_value=mock_stream_service),
    )
    monkeypatch.setattr(
        "src.server.research_create_api.get_session_repository",
        MagicMock(return_value=MagicMock()),
    )

    request = ResearchAskRequest(
        question="What is quantum computing?",
        ask_type="initial",
        frontend_uuid="uuid-1",
        visitor_id="visitor-1",
        config={},
    )

    chunks = [chunk async for chunk in service._handle_stream_ask(request)]

    assert any("event: navigation" in chunk for chunk in chunks)
    nav_data = next(
        json.loads(chunk.split("data: ", 1)[1].strip())
        for chunk in chunks
        if chunk.startswith("data: ") and "workspace_url" in chunk
    )
    assert nav_data["workspace_url"] == "/workspace?id=slug-1"
    assert nav_data["session_id"] == 1
    assert captured["existing_session_id"] == 1
    assert captured["existing_thread_id"] == "thread-1"
    assert captured["request"].action.value == "create"


@pytest.mark.asyncio
async def test_handle_non_stream_ask_rejects_unsupported_ask_type():
    """Non-stream path must reject unknown ask_type with HTTP 400."""
    service = _service()
    request = ResearchAskRequest.model_construct(
        question="test",
        ask_type="unknown",
        frontend_uuid="uuid-1",
        visitor_id="visitor-1",
        config={},
    )

    with pytest.raises(HTTPException) as exc:
        await service._handle_non_stream_ask(request)

    assert exc.value.status_code == 400
    assert "不支持的ask_type" in exc.value.detail


def _initial_request(**overrides):
    data = {
        "question": "What is quantum computing?",
        "ask_type": "initial",
        "frontend_uuid": "uuid-1",
        "visitor_id": "visitor-1",
        "config": {"model": {"model_name": "claude-haiku-4-5", "provider": "anthropic"}},
    }
    data.update(overrides)
    return ResearchAskRequest(**data)


@pytest.mark.asyncio
async def test_create_initial_session_persists_parsed_config():
    """Stream/non-stream initial flows must create sessions with parsed research/model/output config."""
    session_repo = MagicMock()
    created_session = MagicMock(id=7, thread_id="thread-7")
    session_repo.create_session = AsyncMock(return_value=(created_session, "slug-7"))
    service = ResearchAskService(session_repo=session_repo)

    session_data, thread_id, url_param = await service._create_initial_session(
        _initial_request()
    )

    kwargs = session_repo.create_session.await_args.kwargs
    assert kwargs["initial_question"] == "What is quantum computing?"
    assert kwargs["model_config"] == {
        "model_name": "claude-haiku-4-5",
        "provider": "anthropic",
    }
    assert session_data is created_session
    assert thread_id == kwargs["thread_id"]
    assert url_param == "slug-7"


@pytest.mark.asyncio
async def test_handle_initial_ask_creates_session_and_starts_background_task(monkeypatch):
    """Non-stream initial ask must return navigation metadata and schedule background research."""
    session_repo = MagicMock()
    created_session = MagicMock(id=1, thread_id="thread-1")
    session_repo.create_session = AsyncMock(return_value=(created_session, "slug-1"))

    scheduled = {}

    def capture_task(coro):
        scheduled["coro"] = coro
        coro.close()
        return MagicMock()

    monkeypatch.setattr("src.server.research_create_api.asyncio.create_task", capture_task)

    service = ResearchAskService(session_repo=session_repo)
    response = await service._handle_initial_ask(_initial_request())

    assert response.ask_type == "initial"
    assert response.url_param == "slug-1"
    assert response.session_id == 1
    assert response.workspace_url == "/workspace?id=slug-1"
    assert response.thread_id == session_repo.create_session.await_args.kwargs["thread_id"]
    assert "coro" in scheduled


@pytest.mark.asyncio
async def test_handle_non_stream_ask_dispatches_followup():
    """Non-stream dispatcher must route followup ask_type to _handle_followup_ask."""
    service = _service()
    expected = MagicMock()
    service._handle_followup_ask = AsyncMock(return_value=expected)
    request = _followup_request()

    result = await service._handle_non_stream_ask(request)

    assert result is expected
    service._handle_followup_ask.assert_awaited_once_with(request)


@pytest.mark.asyncio
async def test_handle_followup_ask_success_starts_followup_task(monkeypatch):
    """Non-stream followup must validate session identity and schedule followup background work."""
    session_repo = MagicMock()
    session_repo.get_session_overview = AsyncMock(
        return_value={"id": 42, "thread_id": "thread-abc"}
    )

    scheduled = {}

    def capture_task(coro):
        scheduled["coro"] = coro
        coro.close()
        return MagicMock()

    monkeypatch.setattr("src.server.research_create_api.asyncio.create_task", capture_task)

    service = ResearchAskService(session_repo=session_repo)
    response = await service._handle_followup_ask(_followup_request())

    assert response.ask_type == "followup"
    assert response.session_id == 42
    assert response.thread_id == "thread-abc"
    assert response.url_param == "test-slug"
    assert response.workspace_url == "/workspace?id=test-slug"
    assert "coro" in scheduled


@pytest.mark.asyncio
async def test_handle_non_stream_ask_wraps_unexpected_errors_as_500():
    """Non-stream path must convert unexpected failures into HTTP 500."""
    service = _service()
    service._handle_initial_ask = AsyncMock(side_effect=RuntimeError("db unavailable"))

    with pytest.raises(HTTPException) as exc:
        await service._handle_non_stream_ask(_initial_request())

    assert exc.value.status_code == 500
    assert "研究询问失败" in exc.value.detail
    assert "db unavailable" in exc.value.detail


@pytest.mark.asyncio
async def test_handle_stream_ask_rejects_unsupported_ask_type():
    """Stream path must fail fast for unknown ask_type before session creation."""
    service = _service()
    request = ResearchAskRequest.model_construct(
        question="test",
        ask_type="unknown",
        frontend_uuid="uuid-1",
        visitor_id="visitor-1",
        config={},
    )

    chunks = [chunk async for chunk in service._handle_stream_ask(request)]

    assert any("event: error" in chunk for chunk in chunks)
    payload = json.loads(
        next(chunk.split("data: ", 1)[1].strip() for chunk in chunks if chunk.startswith("data: "))
    )
    assert payload["error_code"] == "STREAM_ERROR"
    assert "Unsupported ask_type" in payload["error_message"]


@pytest.mark.asyncio
async def test_handle_stream_ask_reports_missing_database_url(monkeypatch):
    """Stream path must surface missing DATABASE_URL as SSE error, not hang."""
    session_data = MagicMock(id=1, thread_id="thread-1")
    service = ResearchAskService(session_repo=MagicMock())
    service._create_initial_session = AsyncMock(
        return_value=(session_data, "thread-1", "slug-1")
    )
    monkeypatch.delenv("DATABASE_URL", raising=False)

    chunks = [chunk async for chunk in service._handle_stream_ask(_initial_request())]

    assert any("event: error" in chunk for chunk in chunks)
    error_payload = json.loads(
        next(
            chunk.split("data: ", 1)[1].strip()
            for chunk in chunks
            if chunk.startswith("data: ") and "STREAM_ERROR" in chunk
        )
    )
    assert "DATABASE_URL not configured" in error_payload["error_message"]

    service = _service()

    stream_result = service.ask_research(_initial_request(), stream=True)
    assert hasattr(stream_result, "__aiter__")

    non_stream_result = service.ask_research(_initial_request(), stream=False)
    import asyncio

    assert asyncio.iscoroutine(non_stream_result)
    non_stream_result.close()
