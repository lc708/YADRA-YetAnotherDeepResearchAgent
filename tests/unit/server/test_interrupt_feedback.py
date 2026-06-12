# Copyright (c) 2025 YADRA

import pytest
from pydantic import ValidationError

from src.server.research_create_api import ResearchAskRequest


def _build_interrupt_resume_message(interrupt_feedback: str, message: str) -> str:
    """Mirror continue-stream HITL resume message construction."""
    resume_msg = f"[{interrupt_feedback}]"
    if message:
        resume_msg += f" {message}"
    return resume_msg


def _base_payload(**overrides):
    data = {
        "question": "What is quantum computing?",
        "ask_type": "initial",
        "frontend_uuid": "uuid-1",
        "visitor_id": "visitor-1",
    }
    data.update(overrides)
    return data


@pytest.mark.parametrize(
    "feedback",
    ["accepted", "edit_plan", "skip_research", "reask"],
)
def test_research_ask_request_allows_empty_question_for_hitl_feedback(feedback):
    req = ResearchAskRequest(
        **_base_payload(question="", interrupt_feedback=feedback)
    )
    assert req.interrupt_feedback == feedback
    assert req.question == ""


def test_research_ask_request_allows_whitespace_question_with_interrupt_feedback():
    req = ResearchAskRequest(
        **_base_payload(question="   ", interrupt_feedback="accepted")
    )
    assert req.question == "   "
    assert req.interrupt_feedback == "accepted"


def test_research_ask_request_rejects_whitespace_only_without_hitl():
    with pytest.raises(ValidationError, match="question不能为空"):
        ResearchAskRequest(**_base_payload(question="   "))


@pytest.mark.parametrize(
    "feedback,message,expected",
    [
        ("accepted", "", "[accepted]"),
        ("edit_plan", "revise the outline", "[edit_plan] revise the outline"),
        ("skip_research", "   ", "[skip_research]    "),
        ("reask", "new angle", "[reask] new angle"),
    ],
)
def test_interrupt_resume_message_format(feedback, message, expected):
    assert _build_interrupt_resume_message(feedback, message) == expected
