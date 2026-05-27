"""Tests for SEO-friendly research session URL parameter generation."""

import re

import pytest

from src.utils.url_param_generator import (
    URLParamGenerator,
    generate_url_param,
    validate_url_param,
)


@pytest.fixture
def generator():
    return URLParamGenerator()


def test_extract_keywords_empty_input(generator):
    assert generator.extract_keywords("") == []
    assert generator.extract_keywords("   ") == []


def test_extract_keywords_chinese_question(generator):
    keywords = generator.extract_keywords("如何学习人工智能？", max_keywords=5)
    assert keywords
    assert all(len(word) >= 2 for word in keywords)


def test_extract_keywords_english_question(generator):
    keywords = generator.extract_keywords(
        "What is the best way to learn Python programming?",
        max_keywords=5,
    )
    assert "python" in keywords
    assert "programming" in keywords


def test_chinese_to_pinyin(generator):
    assert generator.chinese_to_pinyin("人工智能") == "ren-gong-zhi-neng"
    assert generator.chinese_to_pinyin("") == ""


def test_generate_url_param_empty_question_uses_fallback_prefix():
    url_param = generate_url_param("")
    assert url_param.startswith("question-")
    assert validate_url_param(url_param)


def test_generate_url_param_english_question_is_valid():
    url_param = generate_url_param("How to implement a RESTful API with authentication")
    assert validate_url_param(url_param)
    assert re.search(r"[a-z]", url_param)


def test_generate_url_param_chinese_question_is_valid():
    url_param = generate_url_param("量子计算对密码学的影响分析")
    assert validate_url_param(url_param)
    assert re.match(r"^[a-zA-Z0-9-]+$", url_param)


@pytest.mark.parametrize(
    "url_param,expected",
    [
        ("valid-slug-abc123", True),
        ("", False),
        ("ab", False),
        ("-starts-with-dash", False),
        ("ends-with-dash-", False),
        ("has--double-dash", False),
        ("invalid_chars!", False),
    ],
)
def test_validate_url_param(url_param, expected):
    assert validate_url_param(url_param) is expected
