# Copyright (c) 2025 YADRA

import os
import logging
from langgraph.graph import StateGraph, START, END
from langgraph.checkpoint.postgres import PostgresSaver
from langgraph.checkpoint.memory import MemorySaver
from src.prompts.planner_model import StepType

logger = logging.getLogger(__name__)

from .types import State
from .nodes import (
    coordinator_node,
    planner_node,
    reporter_node,
    research_team_node,
    researcher_node,
    coder_node,
    human_feedback_node,
    background_investigation_node,
    reask_node,
)


def continue_to_running_research_team(state: State):
    current_plan = state.get("current_plan")
    if not current_plan or not current_plan.steps:
        return "planner"
    if all(step.execution_res for step in current_plan.steps):
        return "planner"
    for step in current_plan.steps:
        if not step.execution_res:
            break
    if step.step_type and step.step_type == StepType.RESEARCH:
        return "researcher"
    if step.step_type and step.step_type == StepType.PROCESSING:
        return "coder"
    return "planner"


def _build_base_graph():
    """Build and return the base state graph with all nodes and edges."""
    builder = StateGraph(State)
    builder.add_edge(START, "coordinator")
    builder.add_node("coordinator", coordinator_node)
    builder.add_node("background_investigator", background_investigation_node)
    builder.add_node("planner", planner_node)
    builder.add_node("reporter", reporter_node)
    builder.add_node("research_team", research_team_node)
    builder.add_node("researcher", researcher_node)
    builder.add_node("coder", coder_node)
    builder.add_node("human_feedback", human_feedback_node)
    builder.add_node("reask", reask_node)  # 添加重新提问节点
    builder.add_edge("background_investigator", "planner")
    builder.add_conditional_edges(
        "research_team",
        continue_to_running_research_team,
        ["planner", "researcher", "coder"],
    )
    builder.add_edge("reporter", END)
    builder.add_edge("reask", END)  # 重新提问节点连接到结束
    return builder


def _setup_postgres_tables():
    """Setup PostgreSQL tables if DATABASE_URL is available."""
    database_url = os.getenv('DATABASE_URL')
    
    if not database_url:
        logger.warning("⚠️  DATABASE_URL not found, skipping PostgreSQL setup")
        return False
    
    try:
        # 使用context manager确保正确的资源管理
        with PostgresSaver.from_conn_string(database_url) as checkpointer:
            checkpointer.setup()  # 创建必要的表
            logger.info("✅ PostgreSQL tables setup completed")
        return True
    except Exception as e:
        logger.error(f"❌ Failed to setup PostgreSQL tables: {e}")
        return False


def build_graph_with_memory():
    """Build and return the agent workflow graph with persistent memory."""
    # 使用全局管理的checkpointer
    global _global_checkpointer
    
    if _global_checkpointer is None:
        _initialize_global_checkpointer()
    
    # build state graph
    builder = _build_base_graph()
    return builder.compile(checkpointer=_global_checkpointer)


def build_graph():
    """Build and return the agent workflow graph without memory."""
    # build state graph
    builder = _build_base_graph()
    return builder.compile()


# 全局变量用于管理长期连接
_global_checkpointer = None

def _initialize_global_checkpointer():
    """初始化全局checkpointer，用于整个应用生命周期"""
    global _global_checkpointer
    
    database_url = os.getenv('DATABASE_URL')
    
    # 临时使用MemorySaver直到完成AsyncPostgresSaver迁移
    logger.warning("🔄 Using MemorySaver temporarily - PostgreSQL async integration in progress")
    _global_checkpointer = MemorySaver()
    return _global_checkpointer
    
    # TODO: 实现AsyncPostgresSaver集成
    # 当前问题：同步PostgresSaver在异步环境中导致NotImplementedError
    # 需要：使用AsyncPostgresSaver + 异步graph构建模式
    # if not database_url:
    #     logger.warning("🔄 Using MemorySaver - DATABASE_URL not found")
    #     _global_checkpointer = MemorySaver()
    #     return _global_checkpointer

# 初始化PostgreSQL表（如果可用）
_setup_postgres_tables()

# 初始化全局checkpointer
_initialize_global_checkpointer()

graph = build_graph()
