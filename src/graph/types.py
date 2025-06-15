# Copyright (c) 2025 YADRA


from langgraph.graph import MessagesState
from typing import Optional, Dict, Any

from src.prompts.planner_model import Plan
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
    original_user_input: Optional[Dict[str, Any]] = None  # 用户原始输入状态
    early_termination: Optional[bool] = None  # 提前终止标记
    termination_reason: Optional[str] = None  # 终止原因
