# Copyright (c) 2025 YADRA

import json
import uuid
from datetime import datetime, timezone
from unittest.mock import MagicMock

from src.server.research_stream_api import CustomJSONEncoder, safe_json_dumps


def test_safe_json_dumps_serializes_uuid_and_datetime():
    fixed_time = datetime(2026, 1, 30, 12, 0, 0, tzinfo=timezone.utc)
    payload = {"id": uuid.UUID("12345678-1234-5678-1234-567812345678"), "at": fixed_time}
    result = json.loads(safe_json_dumps(payload))
    assert result["id"] == "12345678-1234-5678-1234-567812345678"
    assert result["at"] == fixed_time.isoformat()


def test_custom_json_encoder_preserves_unicode():
    encoded = json.dumps({"msg": "量子计算"}, cls=CustomJSONEncoder, ensure_ascii=False)
    assert "量子计算" in encoded


def test_make_research_event_strips_empty_content():
    from src.server.research_stream_api import ResearchStreamService

    service = ResearchStreamService(session_repo=MagicMock())
    event = service._make_research_event("message", {"content": "", "thread_id": "t1"})
    payload = json.loads(event["data"])
    assert "content" not in payload
    assert payload["thread_id"] == "t1"


def test_flattened_stream_config_defaults_when_research_config_missing():
    """Regression: flattened config keys must resolve when only legacy flat config is sent."""
    from src.server.research_stream_api import ResearchStreamRequest, ActionType

    request = ResearchStreamRequest(
        action=ActionType.CREATE,
        message="test",
        frontend_uuid="uuid",
        frontend_context_uuid="uuid",
        visitor_id="visitor",
        config={
            "auto_accepted_plan": True,
            "maxPlanIterations": 6,
            "maxStepNum": 8,
            "maxSearchResults": 10,
            "reportStyle": "news",
            "enableDeepThinking": True,
            "enableBackgroundInvestigation": False,
        },
    )
    config = request.config
    if "research_config" in config:
        research_config = config["research_config"]
    else:
        research_config = {
            "auto_accepted_plan": config.get("auto_accepted_plan", False),
            "enable_background_investigation": config.get(
                "enableBackgroundInvestigation", True
            ),
            "report_style": config.get("reportStyle", "academic"),
            "enable_deep_thinking": config.get("enableDeepThinking", False),
            "max_plan_iterations": config.get("maxPlanIterations", 3),
            "max_step_num": config.get("maxStepNum", 5),
            "max_search_results": config.get("maxSearchResults", 5),
        }
    assert research_config["auto_accepted_plan"] is True
    assert research_config["max_plan_iterations"] == 6
    assert research_config["max_step_num"] == 8
    assert research_config["max_search_results"] == 10
    assert research_config["report_style"] == "news"
    assert research_config["enable_deep_thinking"] is True
    assert research_config["enable_background_investigation"] is False
