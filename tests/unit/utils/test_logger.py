# Copyright (c) 2025 YADRA

from io import StringIO

import pytest
from loguru import logger as loguru_logger

from src.utils.logger import PerformanceLogger, StructuredLogger, get_logger, setup_logging


@pytest.fixture
def restore_loguru_handlers():
    original_handlers = loguru_logger._core.handlers.copy()
    yield
    loguru_logger.remove()
    for handler_id, handler in original_handlers.items():
        loguru_logger._core.handlers[handler_id] = handler


def test_structured_logger_includes_component_extra(restore_loguru_handlers):
    buffer = StringIO()
    loguru_logger.remove()
    loguru_logger.add(buffer, format="{extra[component]}|{message}", level="INFO")

    StructuredLogger("test:component").info("hello world")

    assert "test:component|hello world" in buffer.getvalue()


def test_structured_logger_warning_emits_warning_level(restore_loguru_handlers):
    buffer = StringIO()
    loguru_logger.remove()
    loguru_logger.add(
        buffer,
        format="{level}|{extra[component]}|{message}",
        level="WARNING",
    )

    StructuredLogger("test:component").warning("security notice")

    assert "WARNING|test:component|security notice" in buffer.getvalue()


def test_get_logger_returns_structured_logger_with_component():
    logger = get_logger("research_ask_api")
    assert isinstance(logger, StructuredLogger)
    assert logger.component == "research_ask_api"


def test_setup_logging_component_filter(restore_loguru_handlers, tmp_path):
    """setup_logging sinks must ignore records missing the component extra key."""
    buffer = StringIO()
    loguru_logger.remove()
    setup_logging(log_dir=str(tmp_path), log_level="INFO")
    loguru_logger.remove()
    loguru_logger.add(
        buffer,
        format="{message}",
        level="INFO",
        filter=lambda record: "component" in record["extra"],
    )

    loguru_logger.info("unstructured message")
    StructuredLogger("app").info("structured message")

    output = buffer.getvalue()
    assert "unstructured message" not in output
    assert "structured message" in output


def test_performance_logger_emits_performance_event(restore_loguru_handlers):
    buffer = StringIO()
    loguru_logger.remove()
    loguru_logger.add(
        buffer,
        format="{extra[event]}|{extra[model]}|{extra[success]}",
        level="INFO",
    )

    PerformanceLogger.log_llm_call(
        model="claude-haiku-4-5",
        tokens_input=100,
        tokens_output=50,
        duration_ms=250,
        success=True,
    )

    assert "llm_call|claude-haiku-4-5|True" in buffer.getvalue()


def test_performance_logger_emits_database_query_event(restore_loguru_handlers):
    buffer = StringIO()
    loguru_logger.remove()
    loguru_logger.add(
        buffer,
        format="{extra[event]}|{extra[query_type]}|{extra[rows_affected]}",
        level="INFO",
    )

    PerformanceLogger.log_database_query(
        query_type="select",
        duration_ms=12,
        success=True,
        rows_affected=3,
    )

    assert "database_query|select|3" in buffer.getvalue()


def test_performance_logger_emits_api_request_event(restore_loguru_handlers):
    buffer = StringIO()
    loguru_logger.remove()
    loguru_logger.add(
        buffer,
        format="{extra[event]}|{extra[method]}|{extra[status_code]}|{extra[user_id]}",
        level="INFO",
    )

    PerformanceLogger.log_api_request(
        endpoint="/api/research/ask",
        method="POST",
        status_code=200,
        duration_ms=88,
        user_id="user-123",
    )

    assert "api_request|POST|200|user-123" in buffer.getvalue()
