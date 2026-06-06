# Copyright (c) 2025 YADRA

import pytest

from src.server.research_stream_api import build_interrupt_resume_message


@pytest.mark.parametrize(
    "interrupt_feedback,message,expected",
    [
        ("accepted", "", "[accepted]"),
        ("accepted", "continue please", "[accepted] continue please"),
        ("edit_plan", "", "[edit_plan]"),
        ("skip_research", "skip the rest", "[skip_research] skip the rest"),
        ("reask", "new angle", "[reask] new angle"),
    ],
)
def test_build_interrupt_resume_message_formats_hitl_resume(
    interrupt_feedback, message, expected
):
    """Regression: HITL resume message format must match app.py and stream API."""
    assert build_interrupt_resume_message(interrupt_feedback, message) == expected
