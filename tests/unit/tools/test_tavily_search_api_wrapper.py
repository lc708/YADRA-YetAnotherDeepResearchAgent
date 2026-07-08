# Copyright (c) 2025 YADRA

from unittest.mock import AsyncMock, MagicMock

import pytest
from pydantic import SecretStr

from src.tools.tavily_search.tavily_search_api_wrapper import (
    EnhancedTavilySearchAPIWrapper,
)


@pytest.fixture
def wrapper():
    return EnhancedTavilySearchAPIWrapper.model_construct(
        tavily_api_key=SecretStr("test-tavily-key"),
    )


def test_raw_results_posts_expected_payload(monkeypatch, wrapper):
    captured = {}

    class FakeResponse:
        def raise_for_status(self):
            return None

        def json(self):
            return {"results": [{"title": "Hit"}]}

    def fake_post(url, json):
        captured["url"] = url
        captured["json"] = json
        return FakeResponse()

    monkeypatch.setattr(
        "src.tools.tavily_search.tavily_search_api_wrapper.requests.post",
        fake_post,
    )

    result = wrapper.raw_results(
        "quantum computing",
        max_results=3,
        include_images=True,
        include_raw_content=True,
    )

    assert captured["url"].endswith("/search")
    assert captured["json"]["api_key"] == "test-tavily-key"
    assert captured["json"]["query"] == "quantum computing"
    assert captured["json"]["max_results"] == 3
    assert captured["json"]["include_images"] is True
    assert captured["json"]["include_raw_content"] is True
    assert result == {"results": [{"title": "Hit"}]}


@pytest.mark.asyncio
async def test_raw_results_async_returns_parsed_json(monkeypatch, wrapper):
    class FakeResponse:
        status = 200

        async def text(self):
            return '{"results": [{"title": "Async Hit"}]}'

        async def __aenter__(self):
            return self

        async def __aexit__(self, *_args):
            return None

    class FakeSession:
        def post(self, url, json):
            assert url.endswith("/search")
            assert json["api_key"] == "test-tavily-key"
            assert json["query"] == "async query"
            return FakeResponse()

        async def __aenter__(self):
            return self

        async def __aexit__(self, *_args):
            return None

    monkeypatch.setattr(
        "src.tools.tavily_search.tavily_search_api_wrapper.aiohttp.ClientSession",
        lambda **_kwargs: FakeSession(),
    )

    result = await wrapper.raw_results_async("async query", max_results=2)

    assert result == {"results": [{"title": "Async Hit"}]}


@pytest.mark.asyncio
async def test_raw_results_async_raises_on_non_200(monkeypatch, wrapper):
    class FakeResponse:
        status = 503
        reason = "Service Unavailable"

        async def __aenter__(self):
            return self

        async def __aexit__(self, *_args):
            return None

    class FakeSession:
        def post(self, _url, json=None, **_kwargs):
            return FakeResponse()

        async def __aenter__(self):
            return self

        async def __aexit__(self, *_args):
            return None

    monkeypatch.setattr(
        "src.tools.tavily_search.tavily_search_api_wrapper.aiohttp.ClientSession",
        lambda **_kwargs: FakeSession(),
    )

    with pytest.raises(Exception, match="Error 503: Service Unavailable"):
        await wrapper.raw_results_async("failing query")


def test_clean_results_with_images_merges_pages_and_images(wrapper):
    raw_results = {
        "results": [
            {
                "title": "Page title",
                "url": "https://example.com",
                "content": "summary",
                "score": 0.91,
                "raw_content": "full body",
            }
        ],
        "images": [
            {"url": "https://img.example/a.png", "description": "diagram"},
        ],
    }

    cleaned = wrapper.clean_results_with_images(raw_results)

    assert len(cleaned) == 2
    assert cleaned[0] == {
        "type": "page",
        "title": "Page title",
        "url": "https://example.com",
        "content": "summary",
        "score": 0.91,
        "raw_content": "full body",
    }
    assert cleaned[1] == {
        "type": "image",
        "image_url": "https://img.example/a.png",
        "image_description": "diagram",
    }


def test_clean_results_with_images_omits_missing_raw_content(wrapper):
    raw_results = {
        "results": [
            {
                "title": "No raw",
                "url": "https://example.com",
                "content": "summary",
                "score": 0.5,
            }
        ],
        "images": [],
    }

    cleaned = wrapper.clean_results_with_images(raw_results)

    assert cleaned[0]["type"] == "page"
    assert "raw_content" not in cleaned[0]
