# Copyright (c) 2025 YADRA


import logging

import pytest
from unittest.mock import Mock, call, patch, MagicMock
from src.tools.decorators import LoggedToolMixin, create_logged_tool, log_io


class TestLogIoDecorator:
    def test_log_io_logs_parameters_and_return_value(self, caplog):
        @log_io
        def sample_tool(query, limit=5):
            return f"result-{query}-{limit}"

        with caplog.at_level(logging.INFO, logger="src.tools.decorators"):
            assert sample_tool("hello", limit=3) == "result-hello-3"

        assert "Tool sample_tool called with parameters: hello, limit=3" in caplog.text
        assert "Tool sample_tool returned: result-hello-3" in caplog.text

    def test_log_io_preserves_function_metadata(self):
        @log_io
        def documented_tool():
            """Tool docstring."""
            return "ok"

        assert documented_tool.__name__ == "documented_tool"
        assert documented_tool.__doc__ == "Tool docstring."


class MockBaseTool:
    """Mock base tool class for testing."""

    def _run(self, *args, **kwargs):
        return "base_result"


class TestLoggedToolMixin:

    def test_run_calls_log_operation(self):
        """Test that _run calls _log_operation with correct parameters."""
        # Create a logged tool instance
        LoggedTool = create_logged_tool(MockBaseTool)
        tool = LoggedTool()

        # Mock the _log_operation method
        tool._log_operation = Mock()

        # Call _run with test parameters
        args = ("arg1", "arg2")
        kwargs = {"key1": "value1", "key2": "value2"}
        tool._run(*args, **kwargs)

        # Verify _log_operation was called with correct parameters
        tool._log_operation.assert_called_once_with("_run", *args, **kwargs)

    def test_run_calls_super_run(self):
        """Test that _run calls the parent class _run method."""
        # Create a logged tool instance
        LoggedTool = create_logged_tool(MockBaseTool)
        tool = LoggedTool()

        # Mock the parent _run method
        with patch.object(
            MockBaseTool, "_run", return_value="mocked_result"
        ) as mock_super_run:
            args = ("arg1", "arg2")
            kwargs = {"key1": "value1"}
            result = tool._run(*args, **kwargs)

            # Verify super()._run was called with correct parameters
            mock_super_run.assert_called_once_with(*args, **kwargs)
            # Verify the result is returned
            assert result == "mocked_result"

    def test_run_logs_result(self):
        """Test that _run logs the result with debug level."""
        LoggedTool = create_logged_tool(MockBaseTool)
        tool = LoggedTool()

        with patch("src.tools.decorators.logger.debug") as mock_debug:
            result = tool._run("test_arg")

            # Verify debug log was called with correct message
            mock_debug.assert_has_calls(
                [
                    call("Tool MockBaseTool._run called with parameters: test_arg"),
                    call("Tool MockBaseTool returned: base_result"),
                ]
            )

    def test_run_returns_super_result(self):
        """Test that _run returns the result from parent class."""
        LoggedTool = create_logged_tool(MockBaseTool)
        tool = LoggedTool()

        result = tool._run()
        assert result == "base_result"

    def test_run_with_no_args(self):
        """Test _run method with no arguments."""
        LoggedTool = create_logged_tool(MockBaseTool)
        tool = LoggedTool()

        with patch("src.tools.decorators.logger.debug") as mock_debug:
            tool._log_operation = Mock()

            result = tool._run()

            # Verify _log_operation called with no args
            tool._log_operation.assert_called_once_with("_run")
            # Verify result logging
            mock_debug.assert_called_once()
            assert result == "base_result"

    def test_run_with_mixed_args_kwargs(self):
        """Test _run method with both positional and keyword arguments."""
        LoggedTool = create_logged_tool(MockBaseTool)
        tool = LoggedTool()

        tool._log_operation = Mock()

        args = ("pos1", "pos2")
        kwargs = {"kw1": "val1", "kw2": "val2"}
        result = tool._run(*args, **kwargs)

        # Verify all arguments passed correctly
        tool._log_operation.assert_called_once_with("_run", *args, **kwargs)
        assert result == "base_result"

    def test_run_class_name_replacement(self):
        """Test that class name 'Logged' prefix is correctly removed in logging."""
        LoggedTool = create_logged_tool(MockBaseTool)
        tool = LoggedTool()

        with patch("src.tools.decorators.logger.debug") as mock_debug:
            tool._run()

            # Verify the logged class name has 'Logged' prefix removed
            call_args = mock_debug.call_args[0][0]
            assert "Tool MockBaseTool returned:" in call_args
            assert "LoggedMockBaseTool" not in call_args
