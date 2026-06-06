"""
Node 3 — Repository Scan
Analyses file structure, languages, frameworks, and dependencies.
"""

from pathlib import Path
from typing import Any
import structlog

from app.graph.state import AnalysisState
from app.services.repository_scanner import RepositoryScanner

logger = structlog.get_logger(__name__)


async def scan_repo_node(state: AnalysisState) -> dict[str, Any]:
    logger.info("node_scan_repo", analysis_id=state["analysis_id"])

    if not state.get("repo_path"):
        return {
            "repo_metadata": {},
            "errors": ["Skipping repo scan — no repository path available"],
        }

    try:
        scanner = RepositoryScanner(Path(state["repo_path"]))
        metadata = scanner.scan()
        logger.info(
            "scan_complete",
            files=metadata["fileCount"],
            languages=list(metadata["languages"].keys()),
            frameworks=metadata["frameworks"],
        )
        return {"repo_metadata": metadata, "errors": []}
    except Exception as exc:
        logger.error("scan_failed", error=str(exc))
        return {
            "repo_metadata": {},
            "errors": [f"Repository scan failed: {exc}"],
        }
