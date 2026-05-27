"""Tests for MCP tool loading validation and error handling."""

import pytest
from fastapi import HTTPException

from src.server.mcp_utils import load_mcp_tools


@pytest.mark.asyncio
async def test_load_mcp_tools_stdio_requires_command():
    with pytest.raises(HTTPException) as exc_info:
        await load_mcp_tools("stdio")

    assert exc_info.value.status_code == 400
    assert "Command is required" in exc_info.value.detail


@pytest.mark.asyncio
async def test_load_mcp_tools_sse_requires_url():
    with pytest.raises(HTTPException) as exc_info:
        await load_mcp_tools("sse")

    assert exc_info.value.status_code == 400
    assert "URL is required" in exc_info.value.detail


@pytest.mark.asyncio
async def test_load_mcp_tools_rejects_unsupported_type():
    with pytest.raises(HTTPException) as exc_info:
        await load_mcp_tools("websocket")

    assert exc_info.value.status_code == 400
    assert "Unsupported server type" in exc_info.value.detail
