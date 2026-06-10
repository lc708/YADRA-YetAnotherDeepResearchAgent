# Copyright (c) 2025 YADRA


import os
import types
import pytest
from src.llms import llm


class DummyChatOpenAI:
    def __init__(self, **kwargs):
        self.kwargs = kwargs

    def invoke(self, msg):
        return f"Echo: {msg}"


class DummyChatDeepSeek(DummyChatOpenAI):
    pass


@pytest.fixture(autouse=True)
def patch_chat_openai(monkeypatch):
    monkeypatch.setattr(llm, "ChatOpenAI", DummyChatOpenAI)
    monkeypatch.setattr(llm, "ChatDeepSeek", DummyChatDeepSeek)


@pytest.fixture
def dummy_conf():
    return {
        "BASIC_MODEL": {"api_key": "test_key", "base_url": "http://test"},
        "REASONING_MODEL": {"api_key": "reason_key"},
        "VISION_MODEL": {"api_key": "vision_key"},
    }


def test_get_env_llm_conf(monkeypatch):
    monkeypatch.setenv("BASIC_MODEL__API_KEY", "env_key")
    monkeypatch.setenv("BASIC_MODEL__BASE_URL", "http://env")
    conf = llm._get_env_llm_conf("basic")
    assert conf["api_key"] == "env_key"
    assert conf["base_url"] == "http://env"


def test_create_llm_use_conf_merges_env(monkeypatch, dummy_conf):
    monkeypatch.setenv("BASIC_MODEL__API_KEY", "env_key")
    result = llm._create_llm_use_conf("basic", dummy_conf)
    assert isinstance(result, DummyChatOpenAI)
    assert result.kwargs["api_key"] == "env_key"
    assert result.kwargs["base_url"] == "http://test"


def test_create_llm_use_conf_reasoning_uses_deepseek_and_api_base(dummy_conf):
    reasoning_conf = {
        **dummy_conf,
        "REASONING_MODEL": {"api_key": "reason_key", "base_url": "http://reason"},
    }
    result = llm._create_llm_use_conf("reasoning", reasoning_conf)
    assert isinstance(result, DummyChatDeepSeek)
    assert result.kwargs["api_key"] == "reason_key"
    assert result.kwargs["api_base"] == "http://reason"
    assert "base_url" not in result.kwargs


def test_create_llm_use_conf_invalid_type(dummy_conf):
    with pytest.raises(ValueError):
        llm._create_llm_use_conf("unknown", dummy_conf)


def test_create_llm_use_conf_empty_conf(monkeypatch):
    with pytest.raises(ValueError):
        llm._create_llm_use_conf("basic", {})


def test_get_llm_by_type_caches(monkeypatch, dummy_conf):
    called = {}

    def fake_load_yaml_config(path):
        called["called"] = True
        return dummy_conf

    monkeypatch.setattr(llm, "load_yaml_config", fake_load_yaml_config)
    llm._llm_cache.clear()
    inst1 = llm.get_llm_by_type("basic")
    inst2 = llm.get_llm_by_type("basic")
    assert inst1 is inst2
    assert called["called"]


@pytest.mark.parametrize(
    "env_value,expected_verify",
    [
        (None, True),
        ("false", True),
        ("FALSE", True),
        ("true", False),
        ("TRUE", False),
    ],
)
def test_create_llm_ssl_verify_defaults_secure(
    monkeypatch, dummy_conf, env_value, expected_verify
):
    captured = {}

    class CapturingHttpxClient:
        def __init__(self, **kwargs):
            captured.update(kwargs)

    monkeypatch.setattr(llm.httpx, "Client", CapturingHttpxClient)
    monkeypatch.delenv("DISABLE_SSL_VERIFY", raising=False)
    if env_value is not None:
        monkeypatch.setenv("DISABLE_SSL_VERIFY", env_value)

    llm._create_llm_use_conf("basic", dummy_conf)
    assert captured["verify"] is expected_verify


def test_create_llm_ssl_disabled_logs_warning(
    monkeypatch, dummy_conf, caplog
):
    monkeypatch.setenv("DISABLE_SSL_VERIFY", "true")

    class CapturingHttpxClient:
        def __init__(self, **kwargs):
            pass

    monkeypatch.setattr(llm.httpx, "Client", CapturingHttpxClient)
    with caplog.at_level("WARNING"):
        llm._create_llm_use_conf("basic", dummy_conf)
    assert "SSL verification is disabled" in caplog.text


def test_create_llm_use_conf_rejects_non_dict_config(dummy_conf):
    bad_conf = {**dummy_conf, "BASIC_MODEL": "not-a-dict"}
    with pytest.raises(ValueError, match="Invalid LLM configuration"):
        llm._create_llm_use_conf("basic", bad_conf)


def test_get_configured_llm_models_merges_yaml_and_env(monkeypatch):
    monkeypatch.setattr(
        llm,
        "load_yaml_config",
        lambda _: {
            "BASIC_MODEL": {"model": "yaml-basic"},
            "VISION_MODEL": {"model": "yaml-vision"},
        },
    )
    monkeypatch.setenv("REASONING_MODEL__MODEL", "env-reasoning")
    models = llm.get_configured_llm_models()
    assert models["basic"] == ["yaml-basic"]
    assert models["vision"] == ["yaml-vision"]
    assert models["reasoning"] == ["env-reasoning"]


def test_get_configured_llm_models_returns_empty_on_load_failure(monkeypatch):
    def boom(_path):
        raise OSError("missing config")

    monkeypatch.setattr(llm, "load_yaml_config", boom)
    assert llm.get_configured_llm_models() == {}
