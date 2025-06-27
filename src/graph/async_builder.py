"""
Async graph builder with PostgreSQL checkpoint support.
"""

import os
from typing import Optional, Tuple
from langgraph.checkpoint.postgres.aio import AsyncPostgresSaver
from langgraph.graph import StateGraph
import asyncio
import logging

from src.graph.types import State
from src.graph.nodes import (
    generalmanager_node,
    projectmanager_node,
    reporter_node,
    research_team_node,
    researcher_node,
    coder_node,
    human_feedback_node,
    background_investigation_node,
    reask_node,
)
from src.prompts.projectmanager_model import StepType

logger = logging.getLogger(__name__)


def continue_to_running_research_team(state: State):
    current_plan = state.get("current_plan")
    if not current_plan or not current_plan.steps:
        return "projectmanager"
    if all(step.execution_res for step in current_plan.steps):
        return "projectmanager"
    for step in current_plan.steps:
        if not step.execution_res:
            break
    if step.step_type and step.step_type == StepType.RESEARCH:
        return "researcher"
    if step.step_type and step.step_type == StepType.PROCESSING:
        return "coder"
    return "projectmanager"


def _build_base_graph() -> StateGraph:
    """Build the base graph structure without checkpointer."""
    from langgraph.graph import START, END

    builder = StateGraph(State)
    builder.add_edge(START, "generalmanager")
    builder.add_node("generalmanager", generalmanager_node)
    builder.add_node("background_investigator", background_investigation_node)
    builder.add_node("projectmanager", projectmanager_node)
    builder.add_node("reporter", reporter_node)
    builder.add_node("research_team", research_team_node)
    builder.add_node("researcher", researcher_node)
    builder.add_node("coder", coder_node)
    builder.add_node("human_feedback", human_feedback_node)
    builder.add_node("reask", reask_node)
    builder.add_edge("background_investigator", "projectmanager")
    builder.add_conditional_edges(
        "research_team",
        continue_to_running_research_team,
        ["projectmanager", "researcher", "coder"],
    )
    builder.add_edge("reporter", END)
    builder.add_edge("reask", END)
    return builder


# Global checkpointer instance
_checkpointer: Optional[AsyncPostgresSaver] = None
_checkpointer_lock = asyncio.Lock()
_checkpointer_context = None


async def get_or_create_checkpointer() -> AsyncPostgresSaver:
    """Get or create the global checkpointer instance."""
    global _checkpointer, _checkpointer_context

    async with _checkpointer_lock:
        if _checkpointer is None:
            db_uri = os.getenv("DATABASE_URL")
            if not db_uri:
                raise ValueError("DATABASE_URL environment variable is required")

            logger.info("🔄 Creating global AsyncPostgresSaver instance...")

            try:
                # Create the context manager and enter it
                _checkpointer_context = AsyncPostgresSaver.from_conn_string(db_uri)
                _checkpointer = await _checkpointer_context.__aenter__()

                # Ensure tables are set up
                await _checkpointer.setup()

                logger.info("✅ Global AsyncPostgresSaver instance created")
            except Exception as e:
                logger.error(f"❌ Failed to create AsyncPostgresSaver: {e}")
                raise

        return _checkpointer


async def create_graph():
    """Create a graph instance with the global checkpointer."""
    # Get or create the global checkpointer
    checkpointer = await get_or_create_checkpointer()

    # Build and compile graph
    builder = _build_base_graph()
    graph = builder.compile(checkpointer=checkpointer)

    return graph


async def cleanup_async_resources():
    """Cleanup the global checkpointer when shutting down."""
    global _checkpointer, _checkpointer_context

    async with _checkpointer_lock:
        if _checkpointer_context is not None:
            try:
                await _checkpointer_context.__aexit__(None, None, None)
                logger.info("✅ Global checkpointer cleaned up")
            except Exception as e:
                logger.error(f"Error cleaning up checkpointer: {e}")
            finally:
                _checkpointer = None
                _checkpointer_context = None
