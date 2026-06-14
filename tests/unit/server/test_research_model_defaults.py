# Copyright (c) 2025 YADRA

from src.server.research_stream_api import ResearchStreamRequest, ActionType


def _resolve_stream_model_info(config: dict) -> dict:
    """Mirror ResearchStreamService metadata defaults (PR #28)."""
    model_config = config.get("model_config", {})
    return {
        "model_name": model_config.get("model_name", "claude-haiku-4-5"),
        "provider": model_config.get("provider", "anthropic"),
        "version": "4.5",
    }


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
    info = _resolve_stream_model_info(request.config)
    assert info["model_name"] == "claude-haiku-4-5"
    assert info["provider"] == "anthropic"
    assert info["version"] == "4.5"


def _resolve_create_api_execution_defaults(model_config: dict) -> dict:
    """Mirror ResearchAskService execution-record defaults (PR #28)."""
    return {
        "model_used": model_config.get("model_name", "claude-haiku-4-5"),
        "provider": model_config.get("provider", "anthropic"),
    }


def test_create_api_execution_model_defaults_match_haiku_4_5():
    """Regression: background/followup tasks must default to claude-haiku-4-5."""
    defaults = _resolve_create_api_execution_defaults({})
    assert defaults["model_used"] == "claude-haiku-4-5"
    assert defaults["provider"] == "anthropic"