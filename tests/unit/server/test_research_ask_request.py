# Copyright (c) 2025 YADRA

import pytest
from pydantic import ValidationError

from src.server.research_create_api import ResearchAskRequest


def _base_payload(**overrides):
    data = {
        "question": "What is quantum computing?",
        "ask_type": "initial",
        "frontend_uuid": "uuid-1",
        "visitor_id": "visitor-1",
    }
    data.update(overrides)
    return data


def test_research_ask_request_rejects_empty_question_without_hitl():
    with pytest.raises(ValidationError, match="question不能为空"):
        ResearchAskRequest(**_base_payload(question="   "))


def test_research_ask_request_allows_empty_question_with_interrupt_feedback():
    req = ResearchAskRequest(
        **_base_payload(question="", interrupt_feedback="accepted")
    )
    assert req.question == ""
    assert req.interrupt_feedback == "accepted"


def test_research_ask_request_requires_non_empty_question_for_initial():
    req = ResearchAskRequest(**_base_payload())
    assert req.question.strip() != ""
