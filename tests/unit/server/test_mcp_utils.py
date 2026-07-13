# Copyright (c) 2025 YADRA

"""Regression tests for MCP tool loading validation in mcp_utils."""

from unittest.mock import MagicMock

import pytest
from fastapi import HTTPException

from src.server.mcp_utils import load_mcp_tools


@pytest.mark.asyncio
async def test_load_mcp_tools_stdio_requires_command():
    with pytest.raises(HTTPException) as exc:
        await load_mcp_tools(server_type="stdio", command=None)

    assert exc.value.status_code == 400
    assert "Command is required" in exc.value.detail


@pytest.mark.asyncio
async def test_load_mcp_tools_sse_requires_url():
    with pytest.raises(HTTPException) as exc:
        await load_mcp_tools(server_type="sse", url=None)

    assert exc.value.status_code == 400
    assert "URL is required" in exc.value.detail


@pytest.mark.asyncio
async def test_load_mcp_tools_rejects_unsupported_server_type():
    with pytest.raises(HTTPException) as exc:
        await load_mcp_tools(server_type="websocket")

    assert exc.value.status_code == 400
    assert "Unsupported server type" in exc.value.detail


@pytest.mark.asyncio
async def test_load_mcp_tools_stdio_delegates_to_client_session(monkeypatch):
    fake_tools = [MagicMock(name="search_tool")]

    async def fake_get_tools(client_context_manager, timeout_seconds=10):
        assert timeout_seconds == 45
        return fake_tools

    monkeypatch.setattr(
        "src.server.mcp_utils._get_tools_from_client_session",
        fake_get_tools,
    )

    tools = await load_mcp_tools(
        server_type="stdio",
        command="npx",
        args=["-y", "mcp-server"],
        timeout_seconds=45,
    )

    assert tools == fake_tools


@pytest.mark.asyncio
async def test_load_mcp_tools_sse_delegates_to_client_session(monkeypatch):
    fake_tools = [MagicMock(name="sse_tool")]

    async def fake_get_tools(client_context_manager, timeout_seconds=10):
        return fake_tools

    monkeypatch.setattr(
        "src.server.mcp_utils._get_tools_from_client_session",
        fake_get_tools,
    )

    tools = await load_mcp_tools(
        server_type="sse",
        url="http://localhost:8080/sse",
        timeout_seconds=30,
    )

    assert tools == fake_tools
