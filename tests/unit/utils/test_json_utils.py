# Copyright (c) 2025 YADRA

import json

import pytest

from src.utils.json_utils import repair_json_output


def test_repair_json_output_parses_valid_json():
    content = '{"key": "value"}'
    result = repair_json_output(content)
    assert json.loads(result) == {"key": "value"}


def test_repair_json_output_strips_json_code_fence():
    content = '```json\n{"a": 1}\n```'
    result = repair_json_output(content)
    assert json.loads(result) == {"a": 1}


def test_repair_json_output_strips_ts_code_fence():
    content = '```ts\n{"items": [1, 2]}\n```'
    result = repair_json_output(content)
    assert json.loads(result) == {"items": [1, 2]}


def test_repair_json_output_returns_plain_text_unchanged():
    content = "not json at all"
    assert repair_json_output(content) == content


def test_repair_json_output_repairs_trailing_comma():
    content = '{"items": [1, 2,],}'
    result = repair_json_output(content)
    assert json.loads(result) == {"items": [1, 2]}


def test_repair_json_output_returns_stripped_content_when_repair_fails(monkeypatch):
    """Regression: unrepairable fenced JSON must not crash callers."""
    content = '```json\n{not valid json at all}\n```'

    def boom(_):
        raise ValueError("repair failed")

    monkeypatch.setattr("src.utils.json_utils.json_repair.loads", boom)
    result = repair_json_output(content)
    assert result == "\n{not valid json at all}\n"
    assert "```" not in result
