# Copyright (c) 2025 YADRA


import json
import logging
import os
from typing import Annotated, Literal

from langchain_core.messages import AIMessage, HumanMessage
from langchain_core.runnables import RunnableConfig
from langchain_core.tools import tool
from langgraph.types import Command, interrupt
from langchain_mcp_adapters.client import MultiServerMCPClient

from src.agents import create_agent
from src.tools.search import LoggedTavilySearch
from src.tools import (
    crawl_tool,
    get_web_search_tool,
    get_retriever_tool,
    python_repl_tool,
)

from src.config.agents import AGENT_LLM_MAP
from src.config.configuration import Configuration
from src.llms.llm import get_llm_by_type
from src.prompts.projectmanager_model import Plan
from src.prompts.template import apply_prompt_template
from src.utils.json_utils import repair_json_output

from .types import State
from ..config import SELECTED_SEARCH_ENGINE, SearchEngine

logger = logging.getLogger(__name__)


@tool
def handoff_to_projectmanager(
    research_topic: Annotated[str, "The topic of the research task to be handed off."],
    locale: Annotated[str, "The user's detected language locale (e.g., en-US, zh-CN)."],
):
    """Handoff to projectmanager agent to do plan."""
    # This tool is not returning anything: we're just using it
    # as a way for LLM to signal that it needs to hand off to projectmanager agent
    return


def background_investigation_node(state: State, config: RunnableConfig):
    logger.info("background investigation node is running.")
    logger.info(f"Research topic: {state.get('research_topic')}")
    logger.info(f"Selected search engine: {SELECTED_SEARCH_ENGINE}")

    configurable = Configuration.from_runnable_config(config)
    query = state.get("research_topic")
    background_investigation_results = None

    if SELECTED_SEARCH_ENGINE == SearchEngine.TAVILY.value:
        logger.info("Using Tavily search engine")
        try:
            searched_content = LoggedTavilySearch(
                max_results=configurable.max_search_results
            ).invoke(query)
            logger.info(
                f"Tavily search returned: {type(searched_content)}, length: {len(searched_content) if isinstance(searched_content, list) else 'N/A'}"
            )

            if isinstance(searched_content, list):
                background_investigation_results = [
                    f"## {elem['title']}\n\n{elem['content']}"
                    for elem in searched_content
                ]
                result = {
                    "background_investigation_results": "\n\n".join(
                        background_investigation_results
                    )
                }
                logger.info(
                    f"Background investigation completed successfully, result length: {len(result['background_investigation_results'])}"
                )
                return result
            else:
                logger.error(
                    f"Tavily search returned malformed response: {searched_content}"
                )
        except Exception as e:
            logger.error(f"Error in Tavily search: {e}")
            logger.exception("Full traceback:")
    else:
        logger.info("Using alternative search engine")
        try:
            background_investigation_results = get_web_search_tool(
                configurable.max_search_results
            ).invoke(query)
            logger.info(
                f"Alternative search completed, result type: {type(background_investigation_results)}"
            )

            result = {
                "background_investigation_results": json.dumps(
                    background_investigation_results, ensure_ascii=False
                )
            }
            logger.info(
                f"Background investigation completed successfully, result length: {len(result['background_investigation_results'])}"
            )
            return result
        except Exception as e:
            logger.error(f"Error in alternative search: {e}")
            logger.exception("Full traceback:")

    # 如果所有搜索都失败，返回空结果
    logger.warning("All search methods failed, returning empty result")
    return {"background_investigation_results": json.dumps(None)}


def projectmanager_node(
    state: State, config: RunnableConfig
) -> Command[Literal["human_feedback", "reporter"]]:
    """Projectmanager node that generate the full plan."""
    logger.info("Projectmanager generating full plan")
    configurable = Configuration.from_runnable_config(config)
    plan_iterations = state["plan_iterations"] if state.get("plan_iterations", 0) else 0
    messages = apply_prompt_template("projectmanager", state, configurable)

    if state.get("enable_background_investigation") and state.get(
        "background_investigation_results"
    ):
        messages += [
            {
                "role": "user",
                "content": (
                    "background investigation results of user query:\n"
                    + state["background_investigation_results"]
                    + "\n"
                ),
            }
        ]

    if configurable.enable_deep_thinking:
        llm = get_llm_by_type("reasoning")
    elif AGENT_LLM_MAP["projectmanager"] == "basic":
        llm = get_llm_by_type("basic").with_structured_output(
            Plan,
            method="json_mode",
        )
    else:
        llm = get_llm_by_type(AGENT_LLM_MAP["projectmanager"])

    # if the plan iterations is greater than the max plan iterations, return the reporter node
    if plan_iterations >= configurable.max_plan_iterations:
        return Command(goto="reporter")

    full_response = ""
    if (
        AGENT_LLM_MAP["projectmanager"] == "basic"
        and not configurable.enable_deep_thinking
    ):
        response = llm.invoke(messages)
        full_response = response.model_dump_json(indent=4, exclude_none=True)
    else:
        response = llm.stream(messages)
        for chunk in response:
            full_response += chunk.content
    logger.debug(f"Current state messages: {state['messages']}")
    logger.info(f"Projectmanager response: {full_response}")

    try:
        curr_plan = json.loads(repair_json_output(full_response))
    except json.JSONDecodeError:
        logger.warning("Projectmanager response is not a valid JSON")
        if plan_iterations > 0:
            return Command(goto="reporter")
        else:
            return Command(goto="__end__")
    if curr_plan.get("has_enough_context"):
        logger.info("Projectmanager response has enough context.")
        new_plan = Plan.model_validate(curr_plan)
        return Command(
            update={
                "messages": [AIMessage(content=full_response, name="projectmanager")],
                "current_plan": new_plan,
            },
            goto="reporter",
        )
    return Command(
        update={
            "messages": [AIMessage(content=full_response, name="projectmanager")],
            "current_plan": full_response,
        },
        goto="human_feedback",
    )


def human_feedback_node(
    state,
) -> Command[
    Literal["projectmanager", "research_team", "reporter", "__end__", "reask"]
]:
    current_plan = state.get("current_plan", "")
    # check if the plan is auto accepted
    auto_accepted_plan = state.get("auto_accepted_plan", False)

    if not auto_accepted_plan:
        # 定义选项
        options = [
            {"text": "开始研究", "value": "accepted"},
            {"text": "立即生成报告", "value": "skip_research"},
            {"text": "编辑计划", "value": "edit_plan"},
            {"text": "重新提问", "value": "reask"},
        ]

        feedback = interrupt(value={"message": "请审查研究计划.", "options": options})

        # if the feedback is not accepted, return the projectmanager node
        if feedback and str(feedback).upper().startswith("[EDIT_PLAN]"):
            return Command(
                update={
                    "messages": [
                        HumanMessage(content=feedback, name="feedback"),
                    ],
                },
                goto="projectmanager",
            )
        elif feedback and str(feedback).upper().startswith("[ACCEPTED]"):
            logger.info("Plan is accepted by user.")
        elif feedback and (
            str(feedback).upper().startswith("[SKIP_RESEARCH]")
            or str(feedback).lower() == "skip_research"
        ):
            logger.info(
                "User requested to skip research and generate report immediately."
            )
            # Skip research and go directly to reporter
            plan_iterations = (
                state["plan_iterations"] if state.get("plan_iterations", 0) else 0
            )
            try:
                current_plan = repair_json_output(current_plan)
                plan_iterations += 1
                new_plan = json.loads(current_plan)
                return Command(
                    update={
                        "current_plan": Plan.model_validate(new_plan),
                        "plan_iterations": plan_iterations,
                        "locale": new_plan.get("locale", "en-US"),
                        "observations": ["用户选择跳过研究步骤，直接生成报告。"],
                        "skipped_research": True,  # 添加标记表示跳过了研究
                    },
                    goto="reporter",
                )
            except json.JSONDecodeError:
                logger.warning("Projectmanager response is not a valid JSON")
                return Command(update={"skipped_research": True}, goto="reporter")
        elif feedback and (
            str(feedback).upper().startswith("[CANCEL]")
            or str(feedback).lower() == "cancel"
        ):
            logger.info("User cancelled the plan.")
            return Command(
                update={
                    "messages": [
                        HumanMessage(
                            content="计划已取消。如需重新开始，请发送新的研究请求。",
                            name="system",
                        ),
                    ],
                },
                goto="__end__",
            )
        elif feedback and (
            str(feedback).upper().startswith("[REASK]")
            or str(feedback).lower() == "reask"
        ):
            logger.info("User requested to reask.")
            return Command(goto="reask")
        else:
            raise TypeError(f"Interrupt value of {feedback} is not supported.")

    # if the plan is accepted, run the following node
    plan_iterations = state["plan_iterations"] if state.get("plan_iterations", 0) else 0
    goto = "research_team"
    try:
        current_plan = repair_json_output(current_plan)
        # increment the plan iterations
        plan_iterations += 1
        # parse the plan
        new_plan = json.loads(current_plan)
        if new_plan["has_enough_context"]:
            goto = "reporter"
    except json.JSONDecodeError:
        logger.warning("Projectmanager response is not a valid JSON")
        if plan_iterations > 0:
            return Command(goto="reporter")
        else:
            return Command(goto="__end__")

    return Command(
        update={
            "current_plan": Plan.model_validate(new_plan),
            "plan_iterations": plan_iterations,
            "locale": new_plan["locale"],
        },
        goto=goto,
    )


def generalmanager_node(
    state: State, config: RunnableConfig
) -> Command[Literal["projectmanager", "background_investigator", "__end__"]]:
    """Generalmanager node that communicate with customers."""
    logger.info("Generalmanager talking.")
    configurable = Configuration.from_runnable_config(config)
    messages = apply_prompt_template("generalmanager", state)
    response = (
        get_llm_by_type(AGENT_LLM_MAP["generalmanager"])
        .bind_tools([handoff_to_projectmanager])
        .invoke(messages)
    )
    logger.debug(f"Current state messages: {state['messages']}")

    # 添加详细的调试日志
    logger.info(f"Generalmanager LLM response type: {type(response)}")
    logger.info(f"Generalmanager LLM response content: {response.content}")
    logger.info(f"Generalmanager LLM response tool_calls: {response.tool_calls}")
    logger.info(
        f"Generalmanager LLM response tool_calls length: {len(response.tool_calls)}"
    )
    logger.info(
        f"Enable background investigation: {state.get('enable_background_investigation')}"
    )

    goto = "__end__"
    locale = state.get("locale", "en-US")  # Default locale if not specified
    research_topic = state.get("research_topic", "")

    if len(response.tool_calls) > 0:
        goto = "projectmanager"
        logger.info("Tool calls detected, setting goto to projectmanager")
        if state.get("enable_background_investigation"):
            # if the search_before_planning is True, add the web search tool to the projectmanager agent
            goto = "background_investigator"
            logger.info(
                "Background investigation enabled, changing goto to background_investigator"
            )
        try:
            for tool_call in response.tool_calls:
                if tool_call.get("name", "") != "handoff_to_projectmanager":
                    continue
                if tool_call.get("args", {}).get("locale") and tool_call.get(
                    "args", {}
                ).get("research_topic"):
                    locale = tool_call.get("args", {}).get("locale")
                    research_topic = tool_call.get("args", {}).get("research_topic")
                    break
        except Exception as e:
            logger.error(f"Error processing tool calls: {e}")
    else:
        logger.warning(
            "Generalmanager response contains no tool calls. Terminating workflow execution."
        )
        logger.debug(f"Generalmanager response: {response}")

    logger.info(f"Final goto decision: {goto}")
    return Command(
        update={
            "locale": locale,
            "research_topic": research_topic,
            "resources": configurable.resources,
        },
        goto=goto,
    )


def reporter_node(state: State, config: RunnableConfig):
    """Reporter node that write a final report."""
    logger.info("Reporter write final report")
    configurable = Configuration.from_runnable_config(config)
    current_plan = state.get("current_plan")
    skipped_research = state.get("skipped_research", False)

    input_ = {
        "messages": [
            HumanMessage(
                f"# Research Requirements\n\n## Task\n\n{current_plan.title}\n\n## Description\n\n{current_plan.thought}"
            )
        ],
        "locale": state.get("locale", "en-US"),
    }
    invoke_messages = apply_prompt_template("reporter", input_, configurable)
    observations = state.get("observations", [])

    # Add a reminder about the new report format, citation style, and table usage
    invoke_messages.append(
        HumanMessage(
            content="IMPORTANT: Follow the exact report structure from the template, including style-specific variations.",
            name="system",
        )
    )

    # 如果跳过了研究，添加特殊提示
    if skipped_research:
        invoke_messages.append(
            HumanMessage(
                content="IMPORTANT: This report is being generated without conducting detailed research steps. Please add a disclaimer at the end of the report stating that the content may be incomplete or less accurate due to skipped research phases. Use this format:\n\n---\n\n**⚠️ 重要提示**：本报告基于有限的信息生成，未进行详细的研究步骤。内容可能不够全面或准确，建议进行进一步的深入研究以获得更可靠的结论。",
                name="system",
            )
        )

    for observation in observations:
        invoke_messages.append(
            HumanMessage(
                content=f"Below are some observations for the research task:\n\n{observation}",
                name="observation",
            )
        )
    logger.debug(f"Current invoke messages: {invoke_messages}")
    response = get_llm_by_type(AGENT_LLM_MAP["reporter"]).invoke(invoke_messages)
    response_content = response.content
    logger.info(f"reporter response: {response_content}")

    return Command(
        update={
            "messages": [AIMessage(content=response_content, name="reporter")],
            "final_report": response_content,
        }
    )


def reask_node(state: State) -> Command[Literal["__end__"]]:
    """重新提问节点 - 恢复用户原始输入状态"""
    logger.info("Reask node: preparing to restore original user input")

    original_input = state.get("original_user_input")
    if not original_input:
        logger.warning("No original user input found, ending workflow")
        return Command(
            update={
                "messages": [
                    HumanMessage(
                        content="无法找到原始输入信息，请重新开始对话。", name="system"
                    ),
                ],
            },
            goto="__end__",
        )

    logger.info(f"Restoring original input: {original_input.get('text', 'N/A')}")

    # 创建一个特殊的reask消息来传递原始输入信息
    reask_message = AIMessage(content="重新提问请求已处理", name="system")

    return Command(
        update={
            "messages": [reask_message],  # 添加reask消息
            "current_plan": None,  # 清空当前计划
            "observations": [],  # 清空研究结果
            "plan_iterations": 0,  # 重置计划迭代
            "final_report": "",  # 清空最终报告
            "early_termination": None,  # 清空提前终止标记
            "termination_reason": None,  # 清空终止原因
            "background_investigation_results": None,  # 清空背景调查结果
            # 从原始输入恢复用户设置
            "auto_accepted_plan": (
                original_input.get("settings", {}).get("auto_accepted_plan", False)
            ),
            "enable_background_investigation": (
                original_input.get("settings", {}).get(
                    "enable_background_investigation", True
                )
            ),
        },
        goto="__end__",
    )


def research_team_node(state: State):
    """Research team node that collaborates on tasks."""
    logger.info("Research team is collaborating on tasks.")
    pass


async def _execute_agent_step(
    state: State, agent, agent_name: str
) -> Command[Literal["research_team"]]:
    """Helper function to execute a step using the specified agent."""
    current_plan = state.get("current_plan")
    observations = state.get("observations", [])

    # Find the first unexecuted step
    current_step = None
    completed_steps = []
    for step in current_plan.steps:
        if not step.execution_res:
            current_step = step
            break
        else:
            completed_steps.append(step)

    if not current_step:
        logger.warning("No unexecuted step found")
        return Command(goto="research_team")

    logger.info(f"Executing step: {current_step.title}, agent: {agent_name}")

    # Format completed steps information
    completed_steps_info = ""
    if completed_steps:
        completed_steps_info = "# Existing Research Findings\n\n"
        for i, step in enumerate(completed_steps):
            completed_steps_info += f"## Existing Finding {i + 1}: {step.title}\n\n"
            completed_steps_info += f"<finding>\n{step.execution_res}\n</finding>\n\n"

    # Prepare the input for the agent with completed steps info
    agent_input = {
        "messages": [
            HumanMessage(
                content=f"{completed_steps_info}# Current Task\n\n## Title\n\n{current_step.title}\n\n## Description\n\n{current_step.description}\n\n## Locale\n\n{state.get('locale', 'en-US')}"
            )
        ]
    }

    # Add citation reminder for researcher agent
    if agent_name == "researcher":
        if state.get("resources"):
            resources_info = "**The user mentioned the following resource files:**\n\n"
            for resource in state.get("resources"):
                resources_info += f"- {resource.title} ({resource.description})\n"

            agent_input["messages"].append(
                HumanMessage(
                    content=resources_info
                    + "\n\n"
                    + "You MUST use the **local_search_tool** to retrieve the information from the resource files.",
                )
            )

        agent_input["messages"].append(
            HumanMessage(
                content="IMPORTANT: DO NOT include inline citations in the text. Instead, track all sources and include a References section at the end using link reference format. Include an empty line between each citation for better readability. Use this format for each reference:\n- [Source Title](URL)\n\n- [Another Source](URL)",
                name="system",
            )
        )

    # Invoke the agent
    default_recursion_limit = 25
    try:
        env_value_str = os.getenv("AGENT_RECURSION_LIMIT", str(default_recursion_limit))
        parsed_limit = int(env_value_str)

        if parsed_limit > 0:
            recursion_limit = parsed_limit
            logger.info(f"Recursion limit set to: {recursion_limit}")
        else:
            logger.warning(
                f"AGENT_RECURSION_LIMIT value '{env_value_str}' (parsed as {parsed_limit}) is not positive. "
                f"Using default value {default_recursion_limit}."
            )
            recursion_limit = default_recursion_limit
    except ValueError:
        raw_env_value = os.getenv("AGENT_RECURSION_LIMIT")
        logger.warning(
            f"Invalid AGENT_RECURSION_LIMIT value: '{raw_env_value}'. "
            f"Using default value {default_recursion_limit}."
        )
        recursion_limit = default_recursion_limit

    logger.info(f"Agent input: {agent_input}")
    result = await agent.ainvoke(
        input=agent_input, config={"recursion_limit": recursion_limit}
    )

    # Process the result
    response_content = result["messages"][-1].content
    logger.debug(f"{agent_name.capitalize()} full response: {response_content}")

    # Update the step with the execution result
    current_step.execution_res = response_content
    logger.info(f"Step '{current_step.title}' execution completed by {agent_name}")

    return Command(
        update={
            "messages": [
                HumanMessage(
                    content=response_content,
                    name=agent_name,
                )
            ],
            "observations": observations + [response_content],
        },
        goto="research_team",
    )


async def _setup_and_execute_agent_step(
    state: State,
    config: RunnableConfig,
    agent_type: str,
    default_tools: list,
) -> Command[Literal["research_team"]]:
    """Helper function to set up an agent with appropriate tools and execute a step.

    This function handles the common logic for both researcher_node and coder_node:
    1. Configures MCP servers and tools based on agent type
    2. Creates an agent with the appropriate tools or uses the default agent
    3. Executes the agent on the current step

    Args:
        state: The current state
        config: The runnable config
        agent_type: The type of agent ("researcher" or "coder")
        default_tools: The default tools to add to the agent

    Returns:
        Command to update state and go to research_team
    """
    configurable = Configuration.from_runnable_config(config)
    mcp_servers = {}
    enabled_tools = {}

    # Extract MCP server configuration for this agent type
    if configurable.mcp_settings:
        for server_name, server_config in configurable.mcp_settings["servers"].items():
            if (
                server_config["enabled_tools"]
                and agent_type in server_config["add_to_agents"]
            ):
                mcp_servers[server_name] = {
                    k: v
                    for k, v in server_config.items()
                    if k in ("transport", "command", "args", "url", "env")
                }
                for tool_name in server_config["enabled_tools"]:
                    enabled_tools[tool_name] = server_name

    # Create and execute agent with MCP tools if available
    if mcp_servers:
        async with MultiServerMCPClient(mcp_servers) as client:
            loaded_tools = default_tools[:]
            for tool in client.get_tools():
                if tool.name in enabled_tools:
                    tool.description = (
                        f"Powered by '{enabled_tools[tool.name]}'.\n{tool.description}"
                    )
                    loaded_tools.append(tool)
            agent = create_agent(agent_type, agent_type, loaded_tools, agent_type)
            return await _execute_agent_step(state, agent, agent_type)
    else:
        # Use default tools if no MCP servers are configured
        agent = create_agent(agent_type, agent_type, default_tools, agent_type)
        return await _execute_agent_step(state, agent, agent_type)


async def researcher_node(
    state: State, config: RunnableConfig
) -> Command[Literal["research_team"]]:
    """Researcher node that do research"""
    logger.info("Researcher node is researching.")
    configurable = Configuration.from_runnable_config(config)
    tools = [get_web_search_tool(configurable.max_search_results), crawl_tool]
    retriever_tool = get_retriever_tool(state.get("resources", []))
    if retriever_tool:
        tools.insert(0, retriever_tool)
    logger.info(f"Researcher tools: {tools}")
    return await _setup_and_execute_agent_step(
        state,
        config,
        "researcher",
        tools,
    )


async def coder_node(
    state: State, config: RunnableConfig
) -> Command[Literal["research_team"]]:
    """Coder node that do code analysis."""
    logger.info("Coder node is coding.")
    return await _setup_and_execute_agent_step(
        state,
        config,
        "coder",
        [python_repl_tool],
    )
