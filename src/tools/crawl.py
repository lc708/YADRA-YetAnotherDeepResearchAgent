# Copyright (c) 2025 YADRA


import logging
from typing import Annotated

from langchain_core.tools import tool
from .decorators import log_io

from src.crawler import Crawler

logger = logging.getLogger(__name__)


@tool
@log_io
def crawl_tool(
    url: Annotated[str, "The url to crawl."],
) -> str:
    """Use this to crawl a url and get a readable content in markdown format."""
    try:
        crawler = Crawler()
        article = crawler.crawl(url)
        return article.to_markdown()
    except BaseException as e:
        error_msg = f"Failed to crawl {url}. Error: {repr(e)}"
        logger.error(error_msg)
        return error_msg
