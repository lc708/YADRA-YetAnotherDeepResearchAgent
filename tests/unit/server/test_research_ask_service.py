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


def test_parse_config_explicit_false_background_investigation_uses_or_chain():
    """Documents current or-chain behavior: explicit False is treated as missing and defaults to True."""
    research, _, _ = _service()._parse_config(
        {"research": {"enable_background_investigation": False}}
    )
    assert research["enable_background_investigation"] is True


def test_build_stream_config_flattens_nested_research_settings():
    stream_config = _service()._build_stream_config(
        {
            "research": {
                "auto_accepted_plan": True,
                "max_research_depth": 4,
                "max_step_num": 7,
                "max_search_results": 9,
                "report_style": "news",
                "enable_deep_thinking": True,
            },
            "output": {"output_format": "html"},
            "interrupt_feedback": "accepted",
        }
    )
    assert stream_config["auto_accepted_plan"] is True
    assert stream_config["enableBackgroundInvestigation"] is True
    assert stream_config["reportStyle"] == "news"
    assert stream_config["enableDeepThinking"] is True
    assert stream_config["maxPlanIterations"] == 4
    assert stream_config["maxStepNum"] == 7
    assert stream_config["maxSearchResults"] == 9
    assert stream_config["outputFormat"] == "html"
    assert stream_config["interrupt_feedback"] == "accepted"
    assert stream_config["research_config"]["max_plan_iterations"] == 4


def test_estimate_research_duration_scales_with_length_and_keywords():
    service = _service()
    short = service._estimate_research_duration("What is AI?")
    medium = service._estimate_research_duration("x" * 150)
    long_q = service._estimate_research_duration("x" * 250)
    complex_q = service._estimate_research_duration("请深入分析并比较两种方案")
    assert short == 60
    assert medium == 90
    assert long_q == 120
    assert complex_q >= 80
    assert service._estimate_research_duration("x" * 500) <= 300
