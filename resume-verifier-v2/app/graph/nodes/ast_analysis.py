"""
Node 4 — AST Analysis
Parses source files using Tree-sitter to extract structural code metadata.
"""

from pathlib import Path
from typing import Any
import structlog

from app.graph.state import AnalysisState
from app.services.ast_parser import ASTParser

logger = structlog.get_logger(__name__)


async def ast_analysis_node(state: AnalysisState) -> dict[str, Any]:
    logger.info("node_ast_analysis", analysis_id=state["analysis_id"])

    if not state.get("repo_path"):
        return {
            "ast_data": {},
            "errors": ["Skipping AST analysis — no repository path"],
        }

    try:
        parser = ASTParser(Path(state["repo_path"]))
        ast_data = parser.parse_repository()

        logger.info(
            "ast_complete",
            functions=len(ast_data.get("functions", [])),
            classes=len(ast_data.get("classes", [])),
            routes=len(ast_data.get("routes", [])),
            services=len(ast_data.get("services", [])),
            controllers=len(ast_data.get("controllers", [])),
        )
        return {"ast_data": ast_data, "errors": []}
    except Exception as exc:
        logger.error("ast_failed", error=str(exc))
        return {
            "ast_data": {},
            "errors": [f"AST analysis failed: {exc}"],
        }
