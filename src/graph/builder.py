# Copyright (c) 2025 YADRA

import os
import logging
from langgraph.graph import StateGraph, START, END
from langgraph.checkpoint.postgres import PostgresSaver
from src.prompts.planner_model import StepType
import psycopg
from psycopg.rows import dict_row
import psycopg_pool
from psycopg_pool import ConnectionPool

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
    builder.add_node("reask", reask_node)
    builder.add_edge("background_investigator", "planner")
    builder.add_conditional_edges(
        "research_team",
        continue_to_running_research_team,
        ["planner", "researcher", "coder"],
    )
    builder.add_edge("reporter", END)
    builder.add_edge("reask", END)
    return builder


# Global PostgresSaver connection
_global_connection_pool = None
_global_checkpointer = None


def _get_postgres_checkpointer():
    """Get or create PostgreSQL checkpointer with connection pool."""
    global _global_checkpointer, _global_connection_pool

    if _global_checkpointer is None:
        database_url = os.getenv("DATABASE_URL")
        if not database_url:
            raise ValueError("DATABASE_URL environment variable is required")

        logger.info("🔄 Initializing PostgresSaver with connection pool...")

        try:
            # 创建连接池
            _global_connection_pool = ConnectionPool(
                database_url,
                min_size=2,  # 最小连接数
                max_size=10,  # 最大连接数
                max_idle=300,  # 最大空闲时间（秒）
                max_lifetime=3600,  # 连接最大生存时间（秒）
                kwargs={
                    "autocommit": True,
                    "row_factory": dict_row,
                    "connect_timeout": 30,  # 连接超时
                    "server_settings": {
                        "application_name": "yadra_agent",
                        "tcp_keepalives_idle": "600",
                        "tcp_keepalives_interval": "30",
                        "tcp_keepalives_count": "3",
                    },
                },
            )

            # 使用连接池创建 checkpointer
            _global_checkpointer = PostgresSaver.from_conn_pool(_global_connection_pool)
            _global_checkpointer.setup()

            logger.info(
                "✅ PostgresSaver with connection pool initialized successfully"
            )
        except Exception as e:
            logger.error(f"❌ Failed to initialize PostgresSaver: {e}")
            raise

    return _global_checkpointer


def build_graph_with_memory():
    """Build and return the agent workflow graph with persistent memory."""
    checkpointer = _get_postgres_checkpointer()
    builder = _build_base_graph()
    return builder.compile(checkpointer=checkpointer)


def build_graph():
    """Build and return the agent workflow graph without memory."""
    builder = _build_base_graph()
    return builder.compile()


def cleanup_postgres_resources():
    """Cleanup PostgreSQL resources."""
    global _global_connection_pool, _global_checkpointer

    if _global_connection_pool:
        _global_connection_pool.close()
        _global_connection_pool = None
        _global_checkpointer = None
        logger.info("✅ PostgreSQL connection pool cleaned up")


# Create default graph instance (without memory to avoid database dependency during import)
graph = build_graph()
