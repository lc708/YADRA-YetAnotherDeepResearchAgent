"""Tests for JSON repair utilities used in LangGraph plan parsing."""

import json
from unittest.mock import patch

import pytest

from src.utils.json_utils import repair_json_output


@pytest.mark.parametrize(
    "content,expected",
    [
        ('{"title": "plan"}', '{"title": "plan"}'),
        ('```json\n{"steps": [1, 2]}\n```', '{"steps": [1, 2]}'),
        ('```ts\n{"ok": true}\n```', '{"ok": true}'),
        ("not json at all", "not json at all"),
        ("", ""),
    ],
)
def test_repair_json_output(content, expected):
    result = repair_json_output(content)
    if expected.startswith("{") or expected.startswith("["):
        assert json.loads(result) == json.loads(expected)
    else:
        assert result == expected


def test_repair_json_output_handles_trailing_fence():
    content = '```json\n{"a": 1}\n```'
    result = repair_json_output(content)
    assert json.loads(result) == {"a": 1}


def test_repair_json_output_returns_stripped_content_when_repair_raises():
    content = "```json\n{broken json\n```"
    with patch("src.utils.json_utils.json_repair.loads", side_effect=ValueError("bad")):
        result = repair_json_output(content)
    assert result == "\n{broken json\n"
