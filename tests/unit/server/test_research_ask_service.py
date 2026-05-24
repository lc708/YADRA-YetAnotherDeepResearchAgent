# Copyright (c) 2025 YADRA

from unittest.mock import MagicMock

from src.server.research_create_api import ResearchAskService


def _service():
    return ResearchAskService(session_repo=MagicMock())


def test_parse_config_uses_nested_research_overrides():
    research, model, output = _service()._parse_config(
        {
            "research": {
                "auto_accepted_plan": True,
                "max_research_depth": 7,
                "max_step_num": 9,
                "max_search_results": 11,
                "report_style": "news",
            },
            "model": {"model_name": "claude-haiku-4-5", "provider": "anthropic"},
            "output": {"language": "en", "output_format": "html"},
        }
    )
    assert research["auto_accepted_plan"] is True
    assert research["max_plan_iterations"] == 7
    assert research["max_step_num"] == 9
    assert research["max_search_results"] == 11
    assert research["report_style"] == "news"
    assert model["model_name"] == "claude-haiku-4-5"
    assert output["language"] == "en"


def test_parse_config_falls_back_to_flat_keys_and_defaults():
    research, model, output = _service()._parse_config(
        {
            "auto_accepted_plan": True,
            "max_plan_iterations": 4,
            "max_step_num": 6,
            "max_search_results": 8,
            "report_style": "casual",
        }
    )
    assert research["auto_accepted_plan"] is True
    assert research["enable_background_investigation"] is True
    assert research["max_plan_iterations"] == 4
    assert research["max_step_num"] == 6
    assert research["max_search_results"] == 8
    assert research["report_style"] == "casual"
    assert model == {}
    assert output == {"language": "zh-CN", "output_format": "markdown"}


def test_parse_config_nested_research_depth_overrides_flat_iterations():
    research, _, _ = _service()._parse_config(
        {
            "research": {"max_research_depth": 2},
            "max_plan_iterations": 99,
        }
    )
    assert research["max_plan_iterations"] == 2
