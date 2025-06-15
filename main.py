# Copyright (c) 2025 YADRA

"""
Entry point script for the YADRA project.
"""

import argparse
import asyncio

from src.workflow import run_agent_workflow_async


def ask(
    question,
    debug=False,
    max_plan_iterations=1,
    max_step_num=3,
    enable_background_investigation=True,
):
    """Run the agent workflow with the given question.

    Args:
        question: The user's query or request
        debug: If True, enables debug level logging
        max_plan_iterations: Maximum number of plan iterations
        max_step_num: Maximum number of steps in a plan
        enable_background_investigation: If True, performs web search before planning to enhance context
    """
    asyncio.run(
        run_agent_workflow_async(
            user_input=question,
            debug=debug,
            max_plan_iterations=max_plan_iterations,
            max_step_num=max_step_num,
            enable_background_investigation=enable_background_investigation,
        )
    )


def main(
    debug=False,
    max_plan_iterations=1,
    max_step_num=3,
    enable_background_investigation=True,
):
    """Interactive mode for professional users.

    Args:
        enable_background_investigation: If True, performs web search before planning to enhance context
        debug: If True, enables debug level logging
        max_plan_iterations: Maximum number of plan iterations
        max_step_num: Maximum number of steps in a plan
    """
    print("🔬 YADRA - Yet Another Deep Research Agent")
    print("=" * 50)
    
    # Direct input for professional users
    initial_question = input("Enter your research question: ").strip()
    
    if not initial_question:
        print("❌ No question provided. Exiting.")
        return
    
    print(f"🚀 Starting research on: {initial_question}")
    print("-" * 50)

    # Pass all parameters to ask function
    ask(
        question=initial_question,
        debug=debug,
        max_plan_iterations=max_plan_iterations,
        max_step_num=max_step_num,
        enable_background_investigation=enable_background_investigation,
    )


if __name__ == "__main__":
    # Set up argument parser
    parser = argparse.ArgumentParser(description="Run YADRA")
    parser.add_argument("query", nargs="*", help="The query to process")
    parser.add_argument(
        "--interactive",
        action="store_true",
        help="Run in interactive mode with built-in questions",
    )
    parser.add_argument(
        "--max_plan_iterations",
        type=int,
        default=1,
        help="Maximum number of plan iterations (default: 1)",
    )
    parser.add_argument(
        "--max_step_num",
        type=int,
        default=3,
        help="Maximum number of steps in a plan (default: 3)",
    )
    parser.add_argument("--debug", action="store_true", help="Enable debug logging")
    parser.add_argument(
        "--no-background-investigation",
        action="store_false",
        dest="enable_background_investigation",
        help="Disable background investigation before planning",
    )

    args = parser.parse_args()

    if args.interactive:
        # Pass command line arguments to main function
        main(
            debug=args.debug,
            max_plan_iterations=args.max_plan_iterations,
            max_step_num=args.max_step_num,
            enable_background_investigation=args.enable_background_investigation,
        )
    else:
        # Parse user input from command line arguments or user input
        if args.query:
            user_query = " ".join(args.query)
        else:
            user_query = input("Enter your query: ")

        # Run the agent workflow with the provided parameters
        ask(
            question=user_query,
            debug=args.debug,
            max_plan_iterations=args.max_plan_iterations,
            max_step_num=args.max_step_num,
            enable_background_investigation=args.enable_background_investigation,
        )
