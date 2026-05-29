# Copyright (c) 2025 YADRA

"""Shared pytest fixtures for YADRA unit tests."""

import os

import pytest

os.environ.setdefault("NEXT_PUBLIC_SUPABASE_URL", "https://example.supabase.co")
os.environ.setdefault("NEXT_PUBLIC_SUPABASE_ANON_KEY", "test-anon-key")
os.environ.setdefault("DATABASE_URL", "postgresql://test:test@localhost:5432/test")

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
