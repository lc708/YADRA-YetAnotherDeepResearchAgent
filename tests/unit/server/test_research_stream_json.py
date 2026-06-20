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
