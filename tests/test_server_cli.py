# Copyright (c) 2025 YADRA

import argparse
import os
from unittest.mock import patch


def _build_parser():
    """Mirror server.py CLI defaults for regression testing."""
    parser = argparse.ArgumentParser(description="Run the YADRA API server")
    parser.add_argument("--reload", action="store_true")
    parser.add_argument("--host", type=str, default="localhost")
    parser.add_argument(
        "--port",
        type=int,
        default=int(os.environ.get("PORT", 8000)),
    )
    parser.add_argument(
        "--log-level",
        type=str,
        default="info",
        choices=["debug", "info", "warning", "error", "critical"],
    )
    return parser


def test_server_cli_port_defaults_to_8000():
    with patch.dict(os.environ, {}, clear=True):
        os.environ.pop("PORT", None)
        args = _build_parser().parse_args([])
    assert args.port == 8000


def test_server_cli_port_reads_port_env_var():
    with patch.dict(os.environ, {"PORT": "9000"}):
        args = _build_parser().parse_args([])
    assert args.port == 9000
