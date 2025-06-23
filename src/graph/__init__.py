# Copyright (c) 2025 YADRA

import asyncio
from .async_builder import create_graph, _build_base_graph

def build_graph_with_memory():
    """Build and return the agent workflow graph with persistent memory."""
    return asyncio.run(create_graph())

def build_graph():
    """Build and return the agent workflow graph without memory."""
    # 使用async_builder的_build_base_graph创建无memory的图
    builder = _build_base_graph()
    return builder.compile()

__all__ = [
    "build_graph_with_memory",
    "build_graph",
    "create_graph",  # 导出异步版本供直接使用
]
