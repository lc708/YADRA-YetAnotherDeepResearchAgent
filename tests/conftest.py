# Copyright (c) 2025 YADRA

"""Shared pytest fixtures and import shims for the test suite."""

import os

os.environ.setdefault("NEXT_PUBLIC_SUPABASE_URL", "https://example.supabase.co")
os.environ.setdefault("NEXT_PUBLIC_SUPABASE_ANON_KEY", "test-anon-key")
os.environ.setdefault("DATABASE_URL", "postgresql://test:test@localhost:5432/test")
