# Copyright (c) 2025 YADRA

from unittest.mock import MagicMock, patch

_create_client_patcher = patch("supabase.create_client", return_value=MagicMock())
_create_client_patcher.start()
