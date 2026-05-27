"""Tests for LLM configuration, env merging, and SSL verification."""

import logging
from unittest.mock import MagicMock, patch

import pytest

from src.llms.llm import (
    _create_llm_use_conf,
    _get_env_llm_conf,
    _get_llm_type_config_keys,
    get_configured_llm_models,
)


def test_get_llm_type_config_keys():
    keys = _get_llm_type_config_keys()
    assert keys["basic"] == "BASIC_MODEL"
    assert keys["reasoning"] == "REASONING_MODEL"
    assert keys["vision"] == "VISION_MODEL"


def test_get_env_llm_conf_parses_model_prefix(monkeypatch):
    monkeypatch.setenv("BASIC_MODEL__API_KEY", "secret")
    monkeypatch.setenv("BASIC_MODEL__BASE_URL", "https://example.com")
    monkeypatch.setenv("OTHER_VAR", "ignored")

    conf = _get_env_llm_conf("basic")

    assert conf == {
        "api_key": "secret",
        "base_url": "https://example.com",
    }


def test_get_env_llm_conf_empty_when_no_matching_vars(monkeypatch):
    monkeypatch.delenv("BASIC_MODEL__API_KEY", raising=False)
    assert _get_env_llm_conf("basic") == {}


@pytest.mark.parametrize(
    "env_value,expected_verify",
    [
        (None, True),
        ("false", True),
        ("true", False),
        ("TRUE", False),
    ],
)
def test_create_llm_use_conf_ssl_verification(
    monkeypatch, env_value, expected_verify, caplog
):
    if env_value is None:
        monkeypatch.delenv("DISABLE_SSL_VERIFY", raising=False)
    else:
        monkeypatch.setenv("DISABLE_SSL_VERIFY", env_value)

    conf = {
        "BASIC_MODEL": {
            "model": "test-model",
            "api_key": "key",
            "base_url": "https://example.com/v1",
        }
    }

    with (
        patch("src.llms.llm.httpx.Client") as mock_client_cls,
        patch("src.llms.llm.ChatOpenAI"),
    ):
        mock_client_cls.return_value = MagicMock()
        with caplog.at_level(logging.WARNING):
            _create_llm_use_conf("basic", conf)

    assert mock_client_cls.call_args.kwargs["verify"] is expected_verify

    if not expected_verify:
        assert any(
            "SSL verification is disabled" in record.message
            for record in caplog.records
            if record.levelno == logging.WARNING
        )


def test_create_llm_use_conf_env_overrides_yaml(monkeypatch):
    monkeypatch.setenv("BASIC_MODEL__MODEL", "env-model")
    conf = {
        "BASIC_MODEL": {
            "model": "yaml-model",
            "api_key": "yaml-key",
            "base_url": "https://yaml.example.com/v1",
        }
    }

    with patch("src.llms.llm.ChatOpenAI") as mock_openai:
        _create_llm_use_conf("basic", conf)

    assert mock_openai.call_args.kwargs["model"] == "env-model"


def test_create_llm_use_conf_reasoning_uses_deepseek_and_renames_base_url():
    conf = {
        "REASONING_MODEL": {
            "model": "deepseek-reasoner",
            "api_key": "key",
            "base_url": "https://api.deepseek.com",
        }
    }

    with patch("src.llms.llm.ChatDeepSeek") as mock_deepseek:
        _create_llm_use_conf("reasoning", conf)

    mock_deepseek.assert_called_once()
    call_kwargs = mock_deepseek.call_args.kwargs
    assert call_kwargs["api_base"] == "https://api.deepseek.com"
    assert "base_url" not in call_kwargs


def test_create_llm_use_conf_unknown_type_raises():
    with pytest.raises(ValueError, match="Unknown LLM type"):
        _create_llm_use_conf("invalid", {})


def test_create_llm_use_conf_missing_configuration_raises():
    with pytest.raises(ValueError, match="No configuration found"):
        _create_llm_use_conf("basic", {})


def test_get_configured_llm_models_reads_yaml_and_env(tmp_path, monkeypatch):
    monkeypatch.setenv("VISION_MODEL__MODEL", "vision-from-env")
    config_file = tmp_path / "conf.yaml"
    config_file.write_text(
        "BASIC_MODEL:\n  model: basic-from-yaml\n"
        "REASONING_MODEL:\n  model: reasoning-from-yaml\n"
    )

    with patch("src.llms.llm._get_config_file_path", return_value=str(config_file)):
        models = get_configured_llm_models()

    assert models["basic"] == ["basic-from-yaml"]
    assert models["reasoning"] == ["reasoning-from-yaml"]
    assert models["vision"] == ["vision-from-env"]


def test_get_configured_llm_models_returns_empty_on_load_failure(monkeypatch):
    with patch(
        "src.llms.llm.load_yaml_config",
        side_effect=RuntimeError("boom"),
    ):
        assert get_configured_llm_models() == {}
