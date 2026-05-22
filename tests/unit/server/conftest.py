# Copyright (c) 2025 YADRA

import os
from unittest.mock import MagicMock, patch

os.environ.setdefault("NEXT_PUBLIC_SUPABASE_URL", "https://example.supabase.co")
os.environ.setdefault("NEXT_PUBLIC_SUPABASE_ANON_KEY", "test-anon-key")

_create_client_patcher = patch("supabase.create_client", return_value=MagicMock())
_create_client_patcher.start()
