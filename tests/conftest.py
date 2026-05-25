# Copyright (c) 2025 YADRA

"""Shared pytest fixtures and import shims for the test suite."""

import os
import sys
import types

os.environ.setdefault("NEXT_PUBLIC_SUPABASE_URL", "https://example.supabase.co")
os.environ.setdefault("NEXT_PUBLIC_SUPABASE_ANON_KEY", "test-anon-key")
os.environ.setdefault("DATABASE_URL", "postgresql://test:test@localhost:5432/test")

# supabase-auth no longer publishes the legacy `gotrue` package name
if "gotrue" not in sys.modules or not hasattr(sys.modules["gotrue"], "types"):
    _gotrue = types.ModuleType("gotrue")
    _gotrue_errors = types.ModuleType("gotrue.errors")
    _gotrue_errors.AuthApiError = type("AuthApiError", (Exception,), {})
    _gotrue_types = types.ModuleType("gotrue.types")
    _gotrue_types.Session = dict
    _gotrue_types.User = dict
    _gotrue.errors = _gotrue_errors
    _gotrue.types = _gotrue_types
    sys.modules["gotrue"] = _gotrue
    sys.modules["gotrue.errors"] = _gotrue_errors
    sys.modules["gotrue.types"] = _gotrue_types
