# Copyright (c) 2025 YADRA

from src.server.research_stream_api import ResearchStreamRequest, ActionType


def _resolve_create_api_model_used(model_config: dict) -> tuple[str, str]:
    """Mirror execution-record defaults in research_create_api (PR #28)."""
    return (
        model_config.get("model_name", "claude-haiku-4-5"),
        model_config.get("provider", "anthropic"),
    )


def _resolve_stream_model_info(config: dict) -> dict:
    """Mirror ResearchStreamService metadata defaults (PR #28)."""
    model_config = config.get("model_config", {})
    return {
        "model_name": model_config.get("model_name", "claude-haiku-4-5"),
        "provider": model_config.get("provider", "anthropic"),
        "version": "4.5",
    }


def test_create_api_execution_defaults_match_haiku_4_5():
    """Regression: PR #28 default model for background/followup execution records."""
    model_name, provider = _resolve_create_api_model_used({})
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
    info = _resolve_stream_model_info(request.config)
    assert info["model_name"] == "claude-haiku-4-5"
    assert info["provider"] == "anthropic"
    assert info["version"] == "4.5"