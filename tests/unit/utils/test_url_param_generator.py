# Copyright (c) 2025 YADRA

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


class TestValidateUrlParam:
    @pytest.mark.parametrize(
        "url_param,expected",
        [
            ("", False),
            ("ab", False),
            ("a" * 101, False),
            ("-starts-with-hyphen", False),
            ("ends-with-hyphen-", False),
            ("has--double-hyphen", False),
            ("invalid_underscore", False),
            ("valid-slug-abc12345", True),
        ],
    )
    def test_validate_url_param(self, generator, url_param, expected):
        assert generator.validate_url_param(url_param) is expected

    def test_module_validate_url_param_matches_instance(self, generator):
        param = "quantum-computing-abc12345"
        assert validate_url_param(param) == generator.validate_url_param(param)


class TestGenerateUrlParam:
    def test_empty_question_uses_question_prefix(self, generator, monkeypatch):
        monkeypatch.setattr(generator, "generate_random_suffix", lambda length=8: "abcd1234")
        result = generator.generate_url_param("   ")
        assert result == "question-abcd1234"
        assert generator.validate_url_param(result)

    def test_english_question_produces_valid_slug(self, generator, monkeypatch):
        monkeypatch.setattr(generator, "generate_random_suffix", lambda length=8: "xyz98765")
        result = generator.generate_url_param(
            "What is the best way to learn Python programming?"
        )
        assert result.endswith("-xyz98765")
        assert generator.validate_url_param(result)
        assert re.match(r"^[a-zA-Z0-9-]+$", result)

    def test_chinese_question_produces_pinyin_slug(self, generator, monkeypatch):
        monkeypatch.setattr(generator, "generate_random_suffix", lambda length=8: "cn123456")
        result = generator.generate_url_param("量子计算对密码学的影响")
        assert result.endswith("-cn123456")
        assert generator.validate_url_param(result)
        assert "liang" in result or "zi" in result or "ji" in result

    def test_chinese_to_pinyin_returns_empty_for_blank_text(self, generator):
        assert generator.chinese_to_pinyin("") == ""
        assert generator.chinese_to_pinyin("   ") == ""

    def test_generate_url_param_falls_back_when_no_keywords_extracted(
        self, generator, monkeypatch
    ):
        monkeypatch.setattr(generator, "extract_keywords", lambda text, max_keywords=6: [])
        monkeypatch.setattr(generator, "generate_random_suffix", lambda length=8: "fallback1")
        result = generator.generate_url_param("the and or")
        assert result == "question-fallback1"

    def test_generate_url_param_truncates_overlong_keyword_part(self, generator, monkeypatch):
        monkeypatch.setattr(generator, "generate_random_suffix", lambda length=8: "short123")
        long_question = "analysis " * 30
        result = generator.generate_url_param(long_question, max_length=30)
        assert len(result) <= 30
        assert result.endswith("-short123")
        assert generator.validate_url_param(result)

    def test_module_generate_url_param_matches_instance(self, generator, monkeypatch):
        monkeypatch.setattr(
            URLParamGenerator,
            "generate_random_suffix",
            lambda self, length=8: "fixed123",
        )
        question = "Bitcoin price analysis"
        assert generate_url_param(question) == generator.generate_url_param(question)


class TestExtractKeywords:
    def test_empty_text_returns_empty_list(self, generator):
        assert generator.extract_keywords("") == []
        assert generator.extract_keywords("   ") == []

    def test_filters_stopwords_and_short_tokens(self, generator):
        keywords = generator.extract_keywords("the AI market trends in 2026")
        assert "the" not in keywords
        assert any(k in ("ai", "market", "trends") for k in keywords)
