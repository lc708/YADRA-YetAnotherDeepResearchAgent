# Copyright (c) 2025 YADRA

import json
import uuid
from datetime import datetime, timezone

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
