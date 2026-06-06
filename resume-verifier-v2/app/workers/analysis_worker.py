"""
Celery worker — receives an analysis_id, runs the full LangGraph workflow,
and persists results to PostgreSQL.

Celery tasks must be synchronous; the async workflow runs on a persistent
event loop that is created once per worker process and reused across all
tasks. Using asyncio.run() would create+destroy a loop each task, which
corrupts grpc.aio's global event loop reference, causing all subsequent
gRPC calls (Gemini) to fail with "Event loop is closed".
"""

import asyncio
import time
import uuid
from pathlib import Path
from typing import Optional

import structlog
from celery import Task
from sqlalchemy.orm import Session

from app.core.celery_app import celery_app
from app.core.config import settings
from app.core.database import SyncSessionLocal
from app.graph.workflow import run_workflow
from app.graph.state import AnalysisState
from app.models.analysis import (
    AnalysisJob, AnalysisResult, ClaimResult,
    JobStatus, RepositoryMetadata, VerificationReport,
)
from app.services.github_zip_service import GitHubZipService

logger = structlog.get_logger(__name__)

# One event loop per worker process, reused across all tasks so that
# grpc.aio's internal loop reference stays valid between task invocations.
_worker_loop: Optional[asyncio.AbstractEventLoop] = None


def _run_async(coro):
    global _worker_loop
    if _worker_loop is None or _worker_loop.is_closed():
        _worker_loop = asyncio.new_event_loop()
        asyncio.set_event_loop(_worker_loop)
    return _worker_loop.run_until_complete(coro)


def _get_db() -> Session:
    return SyncSessionLocal()


class AnalysisTask(Task):
    abstract = True

    def on_failure(self, exc, task_id, args, kwargs, einfo):
        analysis_id = args[0] if args else None
        if analysis_id:
            db = _get_db()
            try:
                job = db.query(AnalysisJob).filter(AnalysisJob.id == analysis_id).first()
                if job:
                    job.status = JobStatus.FAILED
                    job.error_message = str(exc)[:1000]
                    db.commit()
            finally:
                db.close()
        logger.error("worker_task_failed", task_id=task_id, error=str(exc))


@celery_app.task(
    bind=True,
    base=AnalysisTask,
    name="app.workers.analysis_worker.run_analysis",
    max_retries=2,
    default_retry_delay=15,
)
def run_analysis(self, analysis_id: str) -> dict:
    start = time.time()
    temp_dir: Optional[str] = None

    # ── Load job and mark as processing, then release the connection ─────────
    # The workflow can run for 10-15 minutes. Holding a DB connection open that
    # entire time causes the managed PG server to drop it (idle connection timeout).
    # We close the session here and open a fresh one after the workflow finishes.
    db = _get_db()
    try:
        job = db.query(AnalysisJob).filter(AnalysisJob.id == analysis_id).first()
        if not job:
            raise ValueError(f"Job {analysis_id} not found")

        candidate_id = job.candidate_id
        github_url = job.github_url
        resume_text = job.resume_text

        job.status = JobStatus.PROCESSING
        job.celery_task_id = self.request.id
        db.commit()
        logger.info("worker_started", analysis_id=analysis_id, candidate=candidate_id)
    finally:
        db.close()

    try:
        # ── Build initial LangGraph state ────────────────────────────────────
        initial_state: dict = {
            "analysis_id": str(analysis_id),
            "candidate_id": candidate_id,
            "github_url": github_url,
            "resume_text": resume_text,
            "claims": [],
            "repo_path": "",
            "temp_dir": "",
            "default_branch": "main",
            "repo_metadata": {},
            "ast_data": {},
            "verification_results": [],
            "authenticity_result": {},
            "scores": {},
            "trust_score": 0.0,
            "recommendation": "",
            "risk_level": "MEDIUM",
            "report": {},
            "errors": [],
        }

        # ── Run LangGraph workflow ───────────────────────────────────────────
        final_state: AnalysisState = _run_async(run_workflow(initial_state))
        temp_dir = final_state.get("temp_dir")
        processing_time = time.time() - start

        # ── Persist results in a fresh session ───────────────────────────────
        db = _get_db()
        try:
            job = db.query(AnalysisJob).filter(AnalysisJob.id == analysis_id).first()

            repo_meta_data = final_state.get("repo_metadata", {})
            if repo_meta_data:
                repo_meta = RepositoryMetadata(
                    analysis_id=analysis_id,
                    github_url=github_url,
                    default_branch=final_state.get("default_branch", "main"),
                    file_count=repo_meta_data.get("fileCount", 0),
                    folder_count=repo_meta_data.get("folderCount", 0),
                    total_size_bytes=repo_meta_data.get("totalSizeBytes", 0),
                    languages=repo_meta_data.get("languages", {}),
                    frameworks=repo_meta_data.get("frameworks", []),
                    dependencies=repo_meta_data.get("dependencies", {}),
                    has_dockerfile=repo_meta_data.get("hasDockerfile", False),
                    has_docker_compose=repo_meta_data.get("hasDockerCompose", False),
                    has_readme=repo_meta_data.get("hasReadme", False),
                    has_tests=repo_meta_data.get("hasTests", False),
                )
                db.add(repo_meta)
                db.flush()

            auth_result = final_state.get("authenticity_result", {})
            ast_data = final_state.get("ast_data", {})
            scores = final_state.get("scores", {})

            result = AnalysisResult(
                analysis_id=analysis_id,
                trust_score=final_state.get("trust_score", 0.0),
                quality_score=scores.get("codeQuality", 0.0),
                authenticity_score=scores.get("authenticity", 0.0),
                architecture_score=scores.get("architectureQuality", 0.0),
                security_score=scores.get("securityQuality", 0.0),
                feature_verification_score=scores.get("featureVerification", 0.0),
                risk_level=final_state.get("risk_level", "MEDIUM"),
                recommendation=final_state.get("recommendation", ""),
                ast_metadata=ast_data,
                authenticity_reasoning=auth_result.get("reasoning", []),
                processing_time_seconds=processing_time,
                graph_trace={"errors": final_state.get("errors", [])},
            )
            db.add(result)
            db.flush()

            for cr_data in final_state.get("verification_results", []):
                cr = ClaimResult(
                    analysis_result_id=result.id,
                    claim=cr_data.get("claim", ""),
                    verified=cr_data.get("verified", False),
                    confidence=cr_data.get("confidence", 0.0),
                    depth=cr_data.get("depth", "none"),
                    reasoning=cr_data.get("reasoning", ""),
                    evidence=cr_data.get("evidence", []),
                )
                db.add(cr)

            report_data = final_state.get("report", {})
            report_data["processingTimeSeconds"] = round(processing_time, 2)

            report = VerificationReport(
                analysis_id=analysis_id,
                candidate_id=candidate_id,
                repository_summary=report_data.get("repositorySummary", {}),
                verified_claims=[r for r in final_state.get("verification_results", []) if r.get("verified")],
                missing_claims=[r["claim"] for r in final_state.get("verification_results", []) if not r.get("verified")],
                trust_score=final_state.get("trust_score", 0.0),
                quality_score=scores.get("codeQuality", 0.0),
                authenticity_score=scores.get("authenticity", 0.0),
                risk_level=final_state.get("risk_level", "MEDIUM"),
                recommendation=final_state.get("recommendation", ""),
                full_report=report_data,
            )
            db.add(report)

            if job:
                job.status = JobStatus.COMPLETED
            db.commit()
        except Exception:
            db.rollback()
            raise
        finally:
            db.close()

        logger.info(
            "worker_completed",
            analysis_id=analysis_id,
            trust_score=final_state.get("trust_score"),
            processing_time=round(processing_time, 2),
            errors=len(final_state.get("errors", [])),
        )
        return {"analysisId": str(analysis_id), "trustScore": final_state.get("trust_score")}

    except Exception as exc:
        logger.exception("worker_error", analysis_id=analysis_id, error=str(exc))
        db = _get_db()
        try:
            job = db.query(AnalysisJob).filter(AnalysisJob.id == analysis_id).first()
            if job:
                job.status = JobStatus.FAILED
                job.error_message = str(exc)[:1000]
                db.commit()
        except Exception:
            pass
        finally:
            db.close()
        raise self.retry(exc=exc, countdown=15)

    finally:
        if temp_dir:
            GitHubZipService.cleanup(Path(temp_dir))
