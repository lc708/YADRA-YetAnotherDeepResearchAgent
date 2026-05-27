"""Tests for SSE JSON serialization helpers."""

import json
import uuid
from datetime import datetime, timezone

import pytest

from src.server.research_stream_api import CustomJSONEncoder, safe_json_dumps


def test_custom_json_encoder_serializes_uuid_and_datetime():
    test_uuid = uuid.UUID("12345678-1234-5678-1234-567812345678")
    timestamp = datetime(2026, 1, 30, 12, 0, tzinfo=timezone.utc)

    payload = {"id": test_uuid, "created_at": timestamp}
    encoded = safe_json_dumps(payload)
    decoded = json.loads(encoded)

    assert decoded["id"] == str(test_uuid)
    assert decoded["created_at"] == timestamp.isoformat()


def test_custom_json_encoder_falls_back_for_unknown_types():
    encoder = CustomJSONEncoder()
    with pytest.raises(TypeError):
        encoder.default(object())
