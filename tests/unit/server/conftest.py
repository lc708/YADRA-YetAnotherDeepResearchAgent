# Copyright (c) 2025 YADRA

from unittest.mock import MagicMock, patch

# Patch before any src.server import triggers supabase_client module init.
_create_client_patcher = patch("supabase.create_client", return_value=MagicMock())
_create_client_patcher.start()
