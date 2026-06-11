# Copyright (c) 2025 YADRA

"""Shared pytest fixtures and import shims for the test suite."""

import os
import sys
import types

os.environ.setdefault("NEXT_PUBLIC_SUPABASE_URL", "https://example.supabase.co")
os.environ.setdefault("NEXT_PUBLIC_SUPABASE_ANON_KEY", "test-anon-key")
os.environ.setdefault("DATABASE_URL", "postgresql://test:test@localhost:5432/test")

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


# Legacy shim: only stub gotrue when the real package is unavailable (older supabase-auth).
try:
    import gotrue.errors  # noqa: F401
except ImportError:
    _gotrue = types.ModuleType("gotrue")
    _gotrue_errors = types.ModuleType("gotrue.errors")
    for _name in (
        "AuthApiError",
        "AuthError",
        "AuthImplicitGrantRedirectError",
        "AuthInvalidCredentialsError",
        "AuthRetryableError",
        "AuthSessionMissingError",
        "AuthUnknownError",
        "AuthWeakPasswordError",
    ):
        setattr(_gotrue_errors, _name, type(_name, (Exception,), {}))
    _gotrue_types = types.ModuleType("gotrue.types")
    _gotrue_types.Session = dict
    _gotrue_types.User = dict
    _gotrue.errors = _gotrue_errors
    _gotrue.types = _gotrue_types
    sys.modules["gotrue"] = _gotrue
    sys.modules["gotrue.errors"] = _gotrue_errors
    sys.modules["gotrue.types"] = _gotrue_types
