# Copyright (c) 2025 YADRA

import os
import logging
from langgraph.graph import StateGraph, START, END
from langgraph.checkpoint.postgres import PostgresSaver
from src.prompts.planner_model import StepType
import psycopg
from psycopg.rows import dict_row

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
_global_connection = None
_global_checkpointer = None


def _get_postgres_checkpointer():
    """Get or create PostgreSQL checkpointer."""
    global _global_checkpointer, _global_connection
    
    if _global_checkpointer is None:
        database_url = os.getenv('DATABASE_URL')
        if not database_url:
            raise ValueError("DATABASE_URL environment variable is required")
        
        logger.info("🔄 Initializing PostgresSaver...")
        
        # Create a persistent connection with proper settings
        _global_connection = psycopg.connect(
            database_url,
            autocommit=True,
            row_factory=dict_row
        )
        
        # Create checkpointer with the connection
        _global_checkpointer = PostgresSaver(_global_connection)
        _global_checkpointer.setup()
        
        logger.info("✅ PostgresSaver initialized successfully")
    
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
    global _global_connection, _global_checkpointer
    
    if _global_connection:
        _global_connection.close()
        _global_connection = None
        _global_checkpointer = None
        logger.info("✅ PostgreSQL resources cleaned up")


# Initialize on module load
try:
    _get_postgres_checkpointer()
    logger.info("✅ PostgreSQL checkpointer initialized on module load")
except Exception as e:
    logger.error(f"❌ Failed to initialize PostgreSQL checkpointer: {e}")
    raise

# Create default graph instance
graph = build_graph()
