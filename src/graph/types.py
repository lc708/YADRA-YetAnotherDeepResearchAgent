# Copyright (c) 2025 YADRA


from langgraph.graph import MessagesState
from typing import Optional, Dict, Any

from src.prompts.projectmanager_model import Plan
from src.rag import Resource


class State(MessagesState):
    """State for the agent system, extends MessagesState with next field."""

    # Runtime Variables
    locale: str = "en-US"
    research_topic: str = ""
    observations: list[str] = []
    resources: list[Resource] = []
    plan_iterations: int = 0
    current_plan: Plan | str = None
    final_report: str = ""
    auto_accepted_plan: bool = False
    enable_background_investigation: bool = True
    background_investigation_results: str = None

    # Feedback System Fields
    original_user_input: Optional[Dict[str, Any]] = None  # User original input state
    early_termination: Optional[bool] = None  # Early termination flag
    termination_reason: Optional[str] = None  # Termination reason
