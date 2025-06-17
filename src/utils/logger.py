"""
YADRA 日志配置模块
使用 loguru 提供结构化日志
"""

import sys
import json
from pathlib import Path
from typing import Any, Dict
from loguru import logger as loguru_logger
from datetime import datetime


class StructuredLogger:
    """结构化日志器"""
    
    def __init__(self, component: str):
        self.component = component
    
    def _log(self, level: str, message: str, **kwargs):
        """统一的日志方法"""
        extra = {
            "component": self.component,
            "timestamp": datetime.utcnow().isoformat(),
            **kwargs
        }
        # 直接使用 loguru，不使用 structlog
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
    """设置全局日志配置"""
    
    # 创建日志目录
    log_path = Path(log_dir)
    log_path.mkdir(exist_ok=True)
    
    # 移除默认处理器
    loguru_logger.remove()
    
    # 控制台输出（彩色，简化格式）
    loguru_logger.add(
        sys.stderr,
        format="<green>{time:YYYY-MM-DD HH:mm:ss}</green> | <level>{level: <8}</level> | <cyan>{extra[component]}</cyan> | {message}",
        level=log_level,
        colorize=True,
        filter=lambda record: "component" in record["extra"]
    )
    
    # 应用日志文件（JSON格式，便于分析）
    loguru_logger.add(
        log_path / "app.log",
        format="{time:YYYY-MM-DD HH:mm:ss} | {level} | {extra[component]} | {message} | {extra}",
        level=log_level,
        rotation="100 MB",
        retention="7 days",
        encoding="utf-8",
        filter=lambda record: "component" in record["extra"]
    )
    
    # 错误日志文件（单独记录）
    loguru_logger.add(
        log_path / "error.log",
        format="{time:YYYY-MM-DD HH:mm:ss} | {level} | {extra[component]} | {message} | {extra}",
        level="ERROR",
        rotation="50 MB",
        retention="30 days",
        encoding="utf-8",
        filter=lambda record: "component" in record["extra"]
    )
    
    # 性能日志（用于分析瓶颈）
    loguru_logger.add(
        log_path / "performance.log",
        format="{time:YYYY-MM-DD HH:mm:ss} | {extra}",
        level="INFO",
        rotation="50 MB",
        retention="7 days",
        encoding="utf-8",
        filter=lambda record: record["extra"].get("log_type") == "performance"
    )


def get_logger(component: str) -> StructuredLogger:
    """获取组件专用的结构化日志器"""
    return StructuredLogger(component)


# 性能监控日志器
class PerformanceLogger:
    """性能监控专用日志器"""
    
    @staticmethod
    def log_llm_call(
        model: str,
        tokens_input: int,
        tokens_output: int,
        duration_ms: int,
        success: bool,
        **kwargs
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
            **kwargs
        )
    
    @staticmethod
    def log_database_query(
        query_type: str,
        duration_ms: int,
        success: bool,
        rows_affected: int = None,
        **kwargs
    ):
        loguru_logger.info(
            "",
            log_type="performance",
            event="database_query", 
            query_type=query_type,
            duration_ms=duration_ms,
            success=success,
            rows_affected=rows_affected,
            **kwargs
        )
    
    @staticmethod
    def log_api_request(
        endpoint: str,
        method: str,
        status_code: int,
        duration_ms: int,
        user_id: str = None,
        **kwargs
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
            **kwargs
        )


# 导出常用的日志器
app_logger = get_logger("app")
graph_logger = get_logger("graph")
llm_logger = get_logger("llm")
db_logger = get_logger("database")
auth_logger = get_logger("auth")
perf_logger = PerformanceLogger() 