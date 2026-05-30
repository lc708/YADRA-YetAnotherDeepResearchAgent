# Copyright (c) 2025 YADRA

from unittest.mock import MagicMock

from src.server.research_create_api import ResearchAskService
from src.server.research_stream_api import ResearchStreamRequest, ActionType


def test_create_api_model_config_defaults_match_haiku_4_5():
    """Regression: PR #28 execution-record fallback must stay claude-haiku-4-5."""
    _, model_config, _ = ResearchAskService(session_repo=MagicMock())._parse_config({})
    model_name = model_config.get("model_name", "claude-haiku-4-5")
    provider = model_config.get("provider", "anthropic")
    assert model_name == "claude-haiku-4-5"
    assert provider == "anthropic"


def test_stream_request_model_info_defaults_match_haiku_4_5():
    """Regression: PR #28 default model must stay claude-haiku-4-5 when config omits model_name."""
    request = ResearchStreamRequest(
        action=ActionType.CREATE,
        message="test",
        frontend_uuid="uuid",
        frontend_context_uuid="uuid",
        visitor_id="visitor",
        config={"model_config": {}},
    )
    model_name = request.config.get("model_config", {}).get(
        "model_name", "claude-haiku-4-5"
    )
    provider = request.config.get("model_config", {}).get("provider", "anthropic")
    assert model_name == "claude-haiku-4-5"
    assert provider == "anthropic"
