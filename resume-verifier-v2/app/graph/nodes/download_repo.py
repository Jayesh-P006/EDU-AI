"""
Node 2 — Repository Download
Downloads the GitHub repository as a ZIP and extracts it to a temp directory.
Does NOT use git clone or GitHub API — pure ZIP strategy.
"""

from typing import Any
import structlog

from app.graph.state import AnalysisState
from app.services.github_zip_service import GitHubZipService

logger = structlog.get_logger(__name__)


async def download_repo_node(state: AnalysisState) -> dict[str, Any]:
    logger.info("node_download_repo", analysis_id=state["analysis_id"], url=state["github_url"])

    service = GitHubZipService()
    try:
        repo_root, temp_dir, branch = service.download_and_extract(state["github_url"])
        return {
            "repo_path": str(repo_root),
            "temp_dir": str(temp_dir),
            "default_branch": branch,
            "errors": [],
        }
    except Exception as exc:
        logger.error("download_failed", url=state["github_url"], error=str(exc))
        return {
            "repo_path": "",
            "temp_dir": "",
            "default_branch": "main",
            "errors": [f"Repository download failed: {exc}"],
        }
