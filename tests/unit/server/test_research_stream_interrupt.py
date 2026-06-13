# Copyright (c) 2025 YADRA

import pytest
from unittest.mock import AsyncMock, MagicMock, patch

from src.server.research_stream_api import (
    ActionType,
    ResearchStreamRequest,
    ResearchStreamService,
)


def _build_interrupt_resume_message(interrupt_feedback: str, message: str) -> str:
    """Mirror continue_research_stream HITL resume message construction."""
    resume_msg = f"[{interrupt_feedback}]"
    if message:
        resume_msg += f" {message}"
    return resume_msg


@pytest.mark.parametrize(
    "feedback,message,expected",
    [
        ("accepted", "", "[accepted]"),
        ("edit_plan", "revise the outline", "[edit_plan] revise the outline"),
        ("skip_research", " ", "[skip_research]  "),
        ("reask", "new topic", "[reask] new topic"),
    ],
)
def test_interrupt_resume_message_format(feedback, message, expected):
    assert _build_interrupt_resume_message(feedback, message) == expected


@pytest.mark.asyncio
async def test_continue_research_stream_passes_command_resume_for_interrupt_feedback():
    session_repo = MagicMock()
    session = MagicMock()
    session.id = 42
    session_repo.get_session_by_thread_id = AsyncMock(return_value=session)
    session_repo.create_execution_record = AsyncMock(
        return_value=MagicMock(execution_id="exec-1")
    )
    session_repo.get_session_config = AsyncMock(return_value=None)

    service = ResearchStreamService(session_repo)
    service._get_graph = AsyncMock(return_value=MagicMock())

    captured_states = []

    async def fake_process_langgraph_stream(
        graph, initial_state, thread_id, execution_id, request, execution_type="continue"
    ):
        captured_states.append(initial_state)
        if False:
            yield {}

    service._process_langgraph_stream = fake_process_langgraph_stream

    request = ResearchStreamRequest(
        action=ActionType.CONTINUE,
        message="",
        thread_id="thread-abc",
        frontend_uuid="uuid",
        frontend_context_uuid="uuid",
        visitor_id="visitor",
        config={},
        context={"interrupt_feedback": "accepted"},
    )

    with patch("langgraph.types.Command") as mock_command:
        sentinel = object()
        mock_command.return_value = sentinel

        async for _ in service.continue_research_stream(request):
            pass

        mock_command.assert_called_once_with(resume="[accepted]")
        assert captured_states == [sentinel]
