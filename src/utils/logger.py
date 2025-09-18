"""
YADRA logging configuration module
Use loguru to provide structured logging
"""

import sys
import json
from pathlib import Path
from typing import Any, Dict
from loguru import logger as loguru_logger
from datetime import datetime


class StructuredLogger:
    """Structured logger"""

    def __init__(self, component: str):
        self.component = component

    def _log(self, level: str, message: str, **kwargs):
        """Uniform logging method"""
        extra = {
            "component": self.component,
            "timestamp": datetime.utcnow().isoformat(),
            **kwargs,
        }
        # Use loguru directly, not structlog
        getattr(loguru_logger, level)(f"{message}", **extra)

    def info(self, message: str, **kwargs):
        self._log("info", message, **kwargs)

    def warning(self, message: str, **kwargs):
        self._log("warning", message, **kwargs)

    def error(self, message: str, **kwargs):
        self._log("error", message, **kwargs)

    def debug(self, message: str, **kwargs):
        self._log("debug", message, **kwargs)


def setup_logging(log_dir: str = "logs", log_level: str = "INFO"):
    """Set global logging configuration"""

    # Create log directory
    log_path = Path(log_dir)
    log_path.mkdir(exist_ok=True)

    # Remove default handler
    loguru_logger.remove()

    # Console output (colored, simplified format)
    loguru_logger.add(
        sys.stderr,
        format="<green>{time:YYYY-MM-DD HH:mm:ss}</green> | <level>{level: <8}</level> | <cyan>{extra[component]}</cyan> | {message}",
        level=log_level,
        colorize=True,
        filter=lambda record: "component" in record["extra"],
    )

    # Apply log file (JSON format,便于分析)
    loguru_logger.add(
        log_path / "app.log",
        format="{time:YYYY-MM-DD HH:mm:ss} | {level} | {extra[component]} | {message} | {extra}",
        level=log_level,
        rotation="100 MB",
        retention="7 days",
        encoding="utf-8",
        filter=lambda record: "component" in record["extra"],
    )

    # Error log file (separate record)
    loguru_logger.add(
        log_path / "error.log",
        format="{time:YYYY-MM-DD HH:mm:ss} | {level} | {extra[component]} | {message} | {extra}",
        level="ERROR",
        rotation="50 MB",
        retention="30 days",
        encoding="utf-8",
        filter=lambda record: "component" in record["extra"],
    )

    # Performance log (for analyzing bottlenecks)
    loguru_logger.add(
        log_path / "performance.log",
        format="{time:YYYY-MM-DD HH:mm:ss} | {extra}",
        level="INFO",
        rotation="50 MB",
        retention="7 days",
        encoding="utf-8",
        filter=lambda record: record["extra"].get("log_type") == "performance",
    )


def get_logger(component: str) -> StructuredLogger:
    """Get component-specific structured logger"""
    return StructuredLogger(component)


# Performance monitoring logger
class PerformanceLogger:
    """Performance monitoring logger"""

    @staticmethod
    def log_llm_call(
        model: str,
        tokens_input: int,
        tokens_output: int,
        duration_ms: int,
        success: bool,
        **kwargs,
    ):
        loguru_logger.info(
            "",
            log_type="performance",
            event="llm_call",
            model=model,
            tokens_input=tokens_input,
            tokens_output=tokens_output,
            duration_ms=duration_ms,
            success=success,
            **kwargs,
        )

    @staticmethod
    def log_database_query(
        query_type: str,
        duration_ms: int,
        success: bool,
        rows_affected: int = None,
        **kwargs,
    ):
        loguru_logger.info(
            "",
            log_type="performance",
            event="database_query",
            query_type=query_type,
            duration_ms=duration_ms,
            success=success,
            rows_affected=rows_affected,
            **kwargs,
        )

    @staticmethod
    def log_api_request(
        endpoint: str,
        method: str,
        status_code: int,
        duration_ms: int,
        user_id: str = None,
        **kwargs,
    ):
        loguru_logger.info(
            "",
            log_type="performance",
            event="api_request",
            endpoint=endpoint,
            method=method,
            status_code=status_code,
            duration_ms=duration_ms,
            user_id=user_id,
            **kwargs,
        )


# Export commonly used loggers
app_logger = get_logger("app")
graph_logger = get_logger("graph")
llm_logger = get_logger("llm")
db_logger = get_logger("database")
auth_logger = get_logger("auth")
perf_logger = PerformanceLogger()
