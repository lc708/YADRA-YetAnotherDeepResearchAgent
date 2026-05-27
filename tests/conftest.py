"""Shared pytest fixtures for YADRA unit tests."""

import os

# Required before importing server modules that initialize Supabase at import time.
os.environ.setdefault("NEXT_PUBLIC_SUPABASE_URL", "https://example.supabase.co")
os.environ.setdefault("NEXT_PUBLIC_SUPABASE_ANON_KEY", "test-anon-key")

import pytest

import src.config.loader as config_loader
import src.llms.llm as llm_module


@pytest.fixture(autouse=True)
def clear_module_caches():
    """Prevent cross-test pollution from module-level caches."""
    config_loader._config_cache.clear()
    llm_module._llm_cache.clear()
    yield
    config_loader._config_cache.clear()
    llm_module._llm_cache.clear()
