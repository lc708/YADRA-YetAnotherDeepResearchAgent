# Copyright (c) 2025 YADRA

"""Regression tests for Jina crawler client header and auth behavior."""

from unittest.mock import MagicMock, patch

import pytest

from src.crawler.jina_client import JinaClient


@pytest.fixture
def mock_post():
    with patch("src.crawler.jina_client.requests.post") as post:
        response = MagicMock()
        response.text = "<html>page</html>"
        post.return_value = response
        yield post


def test_jina_client_without_api_key_omits_authorization(monkeypatch, mock_post, caplog):
    monkeypatch.delenv("JINA_API_KEY", raising=False)

    with caplog.at_level("WARNING"):
        result = JinaClient().crawl("https://example.com/article")

    assert result == "<html>page</html>"
    headers = mock_post.call_args.kwargs["headers"]
    assert "Authorization" not in headers
    assert headers["Content-Type"] == "application/json"
    assert headers["X-Return-Format"] == "html"
    assert "Jina API key is not set" in caplog.text


def test_jina_client_with_api_key_sends_bearer_token(monkeypatch, mock_post):
    monkeypatch.setenv("JINA_API_KEY", "secret-key")

    JinaClient().crawl("https://example.com/article", return_format="markdown")

    headers = mock_post.call_args.kwargs["headers"]
    assert headers["Authorization"] == "Bearer secret-key"
    assert headers["X-Return-Format"] == "markdown"
    mock_post.assert_called_once_with(
        "https://r.jina.ai/",
        headers=headers,
        json={"url": "https://example.com/article"},
    )
