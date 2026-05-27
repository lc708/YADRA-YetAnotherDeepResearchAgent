"""Tests for YAML config loading and environment variable substitution."""

import textwrap

import pytest

from src.config.loader import load_yaml_config, process_dict, replace_env_vars


def test_replace_env_vars_resolves_existing_variable(monkeypatch):
    monkeypatch.setenv("MY_API_KEY", "secret-value")
    assert replace_env_vars("$MY_API_KEY") == "secret-value"


def test_replace_env_vars_returns_name_when_missing(monkeypatch):
    monkeypatch.delenv("MISSING_VAR", raising=False)
    assert replace_env_vars("$MISSING_VAR") == "MISSING_VAR"


def test_replace_env_vars_passthrough_non_env_strings():
    assert replace_env_vars("plain-text") == "plain-text"
    assert replace_env_vars(123) == 123


def test_process_dict_replaces_nested_env_vars(monkeypatch):
    monkeypatch.setenv("NESTED_URL", "https://example.com")
    config = {
        "BASIC_MODEL": {
            "base_url": "$NESTED_URL",
            "model": "test-model",
            "retries": 3,
        }
    }
    processed = process_dict(config)
    assert processed["BASIC_MODEL"]["base_url"] == "https://example.com"
    assert processed["BASIC_MODEL"]["retries"] == 3


def test_process_dict_empty_input():
    assert process_dict({}) == {}
    assert process_dict(None) == {}


def test_load_yaml_config_missing_file(tmp_path):
    missing = tmp_path / "missing.yaml"
    assert load_yaml_config(str(missing)) == {}


def test_load_yaml_config_loads_and_caches(tmp_path, monkeypatch):
    monkeypatch.setenv("TEST_MODEL_KEY", "from-env")
    config_file = tmp_path / "conf.yaml"
    config_file.write_text(
        textwrap.dedent(
            """
            BASIC_MODEL:
              api_key: $TEST_MODEL_KEY
              model: test-model
            """
        ).strip()
    )

    first = load_yaml_config(str(config_file))
    second = load_yaml_config(str(config_file))

    assert first == second
    assert first["BASIC_MODEL"]["api_key"] == "from-env"
    assert first["BASIC_MODEL"]["model"] == "test-model"
