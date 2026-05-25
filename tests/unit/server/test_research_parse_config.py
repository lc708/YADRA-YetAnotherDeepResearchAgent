# Copyright (c) 2025 YADRA

from unittest.mock import MagicMock

from src.server.research_create_api import ResearchAskService


def _service():
    return ResearchAskService(session_repo=MagicMock())


def test_parse_config_nested_research_defaults():
    research, model, output = _service()._parse_config(
        {
            "research": {
                "auto_accepted_plan": True,
                "enable_background_investigation": False,
                "report_style": "news",
                "enable_deep_thinking": True,
                "max_research_depth": 7,
                "max_step_num": 9,
                "max_search_results": 11,
            },
            "model": {"model_name": "claude-haiku-4-5", "provider": "anthropic"},
            "output": {"language": "en", "output_format": "html"},
        }
    )
    assert research["auto_accepted_plan"] is True
    # Nested False is overridden by `or True` fallback in _parse_config
    assert research["enable_background_investigation"] is True
    assert research["report_style"] == "news"
    assert research["enable_deep_thinking"] is True
    assert research["max_plan_iterations"] == 7
    assert research["max_step_num"] == 9
    assert research["max_search_results"] == 11
    assert model["model_name"] == "claude-haiku-4-5"
    assert output["language"] == "en"


def test_parse_config_flat_fallback_and_output_defaults():
    research, model, output = _service()._parse_config(
        {
            "auto_accepted_plan": True,
            "max_plan_iterations": 2,
            "max_step_num": 4,
            "max_search_results": 6,
        }
    )
    assert research["auto_accepted_plan"] is True
    assert research["enable_background_investigation"] is True
    assert research["report_style"] == "academic"
    assert research["max_plan_iterations"] == 2
    assert model == {}
    assert output == {"language": "zh-CN", "output_format": "markdown"}
