"""
Node 2 — Repository Download
Downloads the GitHub repository as a ZIP and extracts it to a temp directory.
Tries the primary github_url first; falls back to other URLs found in the resume text.
"""

from typing import Any
import structlog

from app.graph.state import AnalysisState
from app.services.github_zip_service import GitHubZipService
from app.services.github_discovery import extract_github_repos
from app.core.config import settings

logger = structlog.get_logger(__name__)


async def download_repo_node(state: AnalysisState) -> dict[str, Any]:
    primary_url = state.get("github_url", "")
    resume_text = state.get("resume_text", "")

    logger.info("node_download_repo", analysis_id=state["analysis_id"], url=primary_url)

    service = GitHubZipService()

    # Build ordered URL list: primary first, then other URLs found in resume
    candidate_urls: list[str] = []
    if primary_url:
        candidate_urls.append(primary_url)
    if resume_text:
        for repo in extract_github_repos(resume_text):
            if repo.github_url not in candidate_urls:
                candidate_urls.append(repo.github_url)

    # Last-resort fallback: hardcoded URLs from config
    if not candidate_urls and settings.fallback_github_urls:
        candidate_urls = list(settings.fallback_github_urls)
        logger.info(
            "download_using_hardcoded_fallback_urls",
            analysis_id=state["analysis_id"],
            fallback_count=len(candidate_urls),
        )

    if not candidate_urls:
        return {
            "repo_path": "",
            "temp_dir": "",
            "default_branch": "main",
            "errors": ["No GitHub URL available — provide a URL or include one in the resume text"],
        }

    last_error = ""
    for url in candidate_urls:
        try:
            repo_root, temp_dir, branch = service.download_and_extract(url)
            is_fallback = url != primary_url
            if is_fallback:
                logger.info(
                    "download_fallback_url_succeeded",
                    primary=primary_url,
                    used=url,
                )
            return {
                "repo_path": str(repo_root),
                "temp_dir": str(temp_dir),
                "default_branch": branch,
                "github_url": url,  # reflect which URL actually worked
                "errors": [f"Primary URL failed; used fallback: {url}"] if is_fallback else [],
            }
        except Exception as exc:
            last_error = str(exc)
            logger.warning("download_attempt_failed", url=url, error=last_error)

    logger.error(
        "all_download_attempts_failed",
        primary=primary_url,
        tried=len(candidate_urls),
        last_error=last_error,
    )
    return {
        "repo_path": "",
        "temp_dir": "",
        "default_branch": "main",
        "errors": [
            f"Repository download failed after trying {len(candidate_urls)} URL(s). "
            f"Last error: {last_error}"
        ],
    }
