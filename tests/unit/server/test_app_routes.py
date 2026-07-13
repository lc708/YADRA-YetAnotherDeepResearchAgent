# Copyright (c) 2025 YADRA

"""Regression tests for lightweight app.py routes (health, RAG, MCP metadata, prompt enhance)."""

from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from fastapi import HTTPException

from src.config.report_style import ReportStyle
from src.server.app import (
    enhance_prompt,
    health_check,
    mcp_server_metadata,
    rag_config,
    rag_resources,
)
from src.server.chat_request import EnhancePromptRequest
from src.server.mcp_request import MCPServerMetadataRequest
from src.server.rag_request import RAGResourceRequest
from src.rag.retriever import Resource


@pytest.mark.asyncio
async def test_health_check_returns_service_status():
    result = await health_check()
    assert result == {"status": "healthy", "service": "yadra-backend"}


@pytest.mark.asyncio
async def test_rag_config_returns_provider_field():
    from src.config.tools import SELECTED_RAG_PROVIDER

    result = await rag_config()
    assert result.provider == SELECTED_RAG_PROVIDER


@pytest.mark.asyncio
async def test_rag_resources_returns_empty_list_when_retriever_unavailable():
    with patch("src.server.app.build_retriever", return_value=None):
        result = await rag_resources(RAGResourceRequest(query="quantum"))

    assert result.resources == []


@pytest.mark.asyncio
async def test_rag_resources_delegates_to_retriever():
    mock_resource = Resource(
        uri="doc://1",
        title="Quantum primer",
        description="Intro",
    )
    mock_retriever = MagicMock()
    mock_retriever.list_resources.return_value = [mock_resource]

    with patch("src.server.app.build_retriever", return_value=mock_retriever):
        result = await rag_resources(RAGResourceRequest(query="quantum"))

    mock_retriever.list_resources.assert_called_once_with("quantum")
    assert result.resources == [mock_resource]


@pytest.mark.asyncio
async def test_enhance_prompt_maps_lowercase_report_style():
    mock_workflow = MagicMock()
    mock_workflow.invoke.return_value = {"output": "enhanced prompt"}

    with patch(
        "src.server.app.build_prompt_enhancer_graph",
        return_value=mock_workflow,
    ):
        result = await enhance_prompt(
            EnhancePromptRequest(
                prompt="Summarize AI trends",
                report_style="news",
            )
        )

    assert result == {"result": "enhanced prompt"}
    invoke_payload = mock_workflow.invoke.call_args[0][0]
    assert invoke_payload["report_style"] == ReportStyle.NEWS


@pytest.mark.asyncio
async def test_enhance_prompt_defaults_invalid_style_to_academic():
    mock_workflow = MagicMock()
    mock_workflow.invoke.return_value = {"output": "enhanced"}

    with patch(
        "src.server.app.build_prompt_enhancer_graph",
        return_value=mock_workflow,
    ):
        await enhance_prompt(
            EnhancePromptRequest(
                prompt="topic",
                report_style="unknown_style",
            )
        )

    invoke_payload = mock_workflow.invoke.call_args[0][0]
    assert invoke_payload["report_style"] == ReportStyle.ACADEMIC


@pytest.mark.asyncio
async def test_mcp_server_metadata_uses_custom_timeout():
    fake_tools = [{"name": "tool-a"}]

    with patch(
        "src.server.app.load_mcp_tools",
        AsyncMock(return_value=fake_tools),
    ) as load_tools:
        response = await mcp_server_metadata(
            MCPServerMetadataRequest(
                transport="stdio",
                command="npx",
                args=["-y", "mcp-server"],
                timeout_seconds=120,
            )
        )

    load_tools.assert_awaited_once_with(
        server_type="stdio",
        command="npx",
        args=["-y", "mcp-server"],
        url=None,
        env=None,
        timeout_seconds=120,
    )
    assert response.tools == fake_tools


@pytest.mark.asyncio
async def test_mcp_server_metadata_reraises_http_exceptions():
    with patch(
        "src.server.app.load_mcp_tools",
        AsyncMock(side_effect=HTTPException(status_code=400, detail="bad request")),
    ):
        with pytest.raises(HTTPException) as exc:
            await mcp_server_metadata(
                MCPServerMetadataRequest(transport="stdio", command="npx")
            )

    assert exc.value.status_code == 400
