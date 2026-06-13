# Copyright (c) 2025 YADRA

import json

from src.utils.json_utils import repair_json_output


def test_repair_json_output_parses_valid_json():
    content = '{"key": "value"}'
    result = repair_json_output(content)
    assert json.loads(result) == {"key": "value"}


def test_repair_json_output_strips_json_code_fence():
    content = '```json\n{"a": 1}\n```'
    result = repair_json_output(content)
    assert json.loads(result) == {"a": 1}


def test_repair_json_output_returns_plain_text_unchanged():
    content = "not json at all"
    assert repair_json_output(content) == content


def test_repair_json_output_repairs_trailing_comma():
    content = '{"items": [1, 2,],}'
    result = repair_json_output(content)
    assert json.loads(result) == {"items": [1, 2]}
