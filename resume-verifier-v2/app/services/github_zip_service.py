import shutil
import tempfile
import zipfile
from pathlib import Path
from typing import Optional
from urllib.parse import urlparse

import httpx
import structlog

from app.core.config import settings

logger = structlog.get_logger(__name__)

BRANCH_CANDIDATES = ["main", "master", "develop", "dev"]


def url_to_zip(github_url: str, branch: str) -> str:
    return f"{github_url.rstrip('/')}/archive/refs/heads/{branch}.zip"


def extract_owner_repo(github_url: str) -> tuple[str, str]:
    path = urlparse(github_url).path.strip("/")
    parts = path.split("/")
    return parts[0], parts[1]


class GitHubZipService:
    """Synchronous ZIP downloader — safe to call from Celery workers."""

    def _build_headers(self) -> dict[str, str]:
        headers = {"User-Agent": "resume-verifier/2.0"}
        if settings.github_token:
            headers["Authorization"] = f"token {settings.github_token}"
        return headers

    def _try_download(self, url: str, dest: Path) -> bool:
        try:
            with httpx.stream(
                "GET",
                url,
                headers=self._build_headers(),
                timeout=settings.download_timeout_seconds,
                follow_redirects=True,
            ) as resp:
                if resp.status_code == 404:
                    return False
                resp.raise_for_status()

                downloaded = 0
                with open(dest, "wb") as f:
                    for chunk in resp.iter_bytes(chunk_size=65536):
                        downloaded += len(chunk)
                        if downloaded > settings.max_repo_size_bytes:
                            raise ValueError(
                                f"Repository exceeds {settings.max_repo_size_mb} MB limit"
                            )
                        f.write(chunk)
            return True
        except (httpx.HTTPStatusError, httpx.RequestError, ValueError):
            dest.unlink(missing_ok=True)
            return False

    def download_and_extract(self, github_url: str) -> tuple[Path, Path, str]:
        """
        Returns (repo_root, temp_dir, branch_used).
        Caller must call cleanup(temp_dir) after processing.
        """
        owner, repo = extract_owner_repo(github_url)
        work_dir = Path(tempfile.mkdtemp(prefix="rvfy2_"))
        zip_path = work_dir / f"{repo}.zip"

        branch_used: Optional[str] = None
        for branch in BRANCH_CANDIDATES:
            zip_url = url_to_zip(github_url, branch)
            logger.info("trying_branch", branch=branch, url=zip_url)
            if self._try_download(zip_url, zip_path):
                branch_used = branch
                break

        if branch_used is None:
            shutil.rmtree(work_dir, ignore_errors=True)
            raise RuntimeError(
                f"Could not download {github_url}. Tried branches: {', '.join(BRANCH_CANDIDATES)}"
            )

        extract_dir = work_dir / "repo"
        extract_dir.mkdir()

        try:
            with zipfile.ZipFile(zip_path, "r") as zf:
                total = sum(i.file_size for i in zf.infolist())
                if total > settings.max_repo_size_bytes:
                    raise ValueError(
                        f"Uncompressed size exceeds {settings.max_repo_size_mb} MB"
                    )
                zf.extractall(extract_dir)
        except zipfile.BadZipFile:
            shutil.rmtree(work_dir, ignore_errors=True)
            raise RuntimeError("Downloaded file is not a valid ZIP archive")

        zip_path.unlink(missing_ok=True)

        # GitHub extracts into <owner>-<repo>-<branch>/
        subdirs = [p for p in extract_dir.iterdir() if p.is_dir()]
        repo_root = subdirs[0] if len(subdirs) == 1 else extract_dir

        logger.info(
            "repo_downloaded",
            url=github_url,
            branch=branch_used,
            root=str(repo_root),
        )
        return repo_root, work_dir, branch_used

    @staticmethod
    def cleanup(temp_dir: Path) -> None:
        shutil.rmtree(temp_dir, ignore_errors=True)
        logger.info("temp_cleaned", path=str(temp_dir))
