# Copyright (c) 2025 YADRA

"""Regression tests for PR #28 langchain_core.messages migration in graph nodes."""

from unittest.mock import MagicMock

import pytest
from langchain_core.messages import HumanMessage, SystemMessage


class _TextResponse:
    def __init__(self, content: str):
        self.content = content


class _CapturingLLM:
    def __init__(self):
        self.messages = None

    def invoke(self, messages):
        self.messages = messages
        return _TextResponse("generated output")


class _StructuredLLM:
    def __init__(self, structured_result):
        self.structured_result = structured_result
        self.messages = None

    def with_structured_output(self, _schema, method="json_mode"):
        assert method == "json_mode"
        return self

    def invoke(self, messages):
        self.messages = messages
        return self.structured_result


@pytest.fixture
def capturing_llm(monkeypatch):
    llm = _CapturingLLM()
    monkeypatch.setattr(
        "src.prose.graph.prose_continue_node.get_llm_by_type",
        lambda _type: llm,
    )
    monkeypatch.setattr(
        "src.prose.graph.prose_continue_node.get_prompt_template",
        lambda _name: "prose system prompt",
    )
    return llm


def test_prose_continue_node_uses_langchain_core_messages(capturing_llm):
    from src.prose.graph.prose_continue_node import prose_continue_node

    result = prose_continue_node({"content": "Continue this paragraph."})

    assert result["output"] == "generated output"
    assert isinstance(capturing_llm.messages[0], SystemMessage)
    assert isinstance(capturing_llm.messages[1], HumanMessage)
    assert capturing_llm.messages[0].content == "prose system prompt"
    assert capturing_llm.messages[1].content == "Continue this paragraph."


def test_podcast_script_writer_node_uses_langchain_core_messages(monkeypatch):
    from src.podcast.graph.script_writer_node import script_writer_node

    script = MagicMock()
    llm = _StructuredLLM(script)
    monkeypatch.setattr(
        "src.podcast.graph.script_writer_node.get_llm_by_type",
        lambda _type: llm,
    )
    monkeypatch.setattr(
        "src.podcast.graph.script_writer_node.get_prompt_template",
        lambda _name: "podcast system prompt",
    )

    result = script_writer_node({"input": "Episode about quantum computing"})

    assert result["script"] is script
    assert result["audio_chunks"] == []
    assert isinstance(llm.messages[0], SystemMessage)
    assert isinstance(llm.messages[1], HumanMessage)
    assert llm.messages[1].content == "Episode about quantum computing"


def test_ppt_composer_node_uses_langchain_core_messages(monkeypatch, tmp_path):
    from src.ppt.graph.ppt_composer_node import ppt_composer_node

    llm = _CapturingLLM()
    monkeypatch.setattr("src.ppt.graph.ppt_composer_node.get_llm_by_type", lambda _type: llm)
    monkeypatch.setattr(
        "src.ppt.graph.ppt_composer_node.get_prompt_template",
        lambda _name: "ppt system prompt",
    )
    monkeypatch.chdir(tmp_path)

    result = ppt_composer_node({"input": "Slides about market trends"})

    assert result["ppt_content"].content == "generated output"
    assert result["ppt_file_path"].endswith(".md")
    assert isinstance(llm.messages[0], SystemMessage)
    assert isinstance(llm.messages[1], HumanMessage)
    assert llm.messages[1].content == "Slides about market trends"


def test_prompt_enhancer_node_builds_human_message_and_strips_prefix(monkeypatch):
    from src.prompt_enhancer.graph.enhancer_node import prompt_enhancer_node

    class EnhancerLLM:
        def __init__(self):
            self.messages = None

        def invoke(self, messages):
            self.messages = messages
            return _TextResponse("Enhanced Prompt: Better question?")

    llm = EnhancerLLM()
    monkeypatch.setattr(
        "src.prompt_enhancer.graph.enhancer_node.get_llm_by_type",
        lambda _type: llm,
    )
    monkeypatch.setattr(
        "src.prompt_enhancer.graph.enhancer_node.apply_prompt_template",
        lambda _name, state: state["messages"],
    )

    result = prompt_enhancer_node(
        {"prompt": "What is AI?", "context": "enterprise research", "report_style": "news"}
    )

    assert result["output"] == "Better question?"
    assert isinstance(llm.messages[0], HumanMessage)
    assert "enterprise research" in llm.messages[0].content
    assert "What is AI?" in llm.messages[0].content


def test_prompt_enhancer_node_returns_original_prompt_on_invoke_failure(monkeypatch):
    from src.prompt_enhancer.graph.enhancer_node import prompt_enhancer_node

    class FailingLLM:
        def invoke(self, _messages):
            raise RuntimeError("model unavailable")

    monkeypatch.setattr(
        "src.prompt_enhancer.graph.enhancer_node.get_llm_by_type",
        lambda _type: FailingLLM(),
    )
    monkeypatch.setattr(
        "src.prompt_enhancer.graph.enhancer_node.apply_prompt_template",
        lambda _name, state: state["messages"],
    )

    original = "Keep this prompt"
    result = prompt_enhancer_node({"prompt": original})

    assert result["output"] == original
