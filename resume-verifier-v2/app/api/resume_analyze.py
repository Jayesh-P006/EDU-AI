"""
Multi-project resume-based verification endpoints.

Flow:
  POST /api/v1/resume/analyze  → parse resume, discover GitHub repos, dispatch parallel Celery jobs
  GET  /api/v1/resume/group/{groupId}  → poll aggregate status of all parallel jobs
  GET  /api/v1/resume/discover  → just discover repos, do not start analysis (preview)
"""
import re
import uuid
from datetime import datetime, timezone
from typing import List

import structlog
from celery import group as celery_group
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.core.config import settings
from app.core.database import get_db
from app.core.security import verify_api_key
from app.models.analysis import AnalysisJob, AnalysisResult, ClaimResult, RepositoryMetadata, JobStatus
from app.schemas.multi_analysis import (
    ResumeToReportRequest, ResumeToReportResponse,
    ResumeDiscoveryResponse, DiscoveredProject,
    GroupStatusResponse, ProjectStatus, AggregatedScores,
    ClaimVerificationItem,
    BatchAnalyzeRequest, BatchAnalyzeResponse, ProjectAnalysisJob,
)
from app.services.github_discovery import (
    extract_github_repos, extract_resume_metadata,
    extract_github_profile_usernames, fetch_repos_from_profile,
)
from app.workers.analysis_worker import run_analysis

logger = structlog.get_logger(__name__)

router = APIRouter(prefix="/api/v1/resume", tags=["resume-discovery"])


# ── 1. Discover repos from resume (preview, no analysis started) ──────────────

@router.post(
    "/discover",
    response_model=ResumeDiscoveryResponse,
    status_code=status.HTTP_200_OK,
    dependencies=[Depends(verify_api_key)],
    summary="Parse resume and return discovered GitHub repositories",
)
async def discover_projects(request: ResumeToReportRequest) -> ResumeDiscoveryResponse:
    """
    Parses resume text and returns discovered GitHub repositories.
    Falls back to GitHub API via githubProfile when PDF links are not plain text.
    Does NOT start analysis — use /analyze to do both.
    """
    meta = extract_resume_metadata(request.resumeText)
    found_repos = meta.get("githubRepos", [])

    # GitHub API fallback when no explicit repo URLs found in text
    if not found_repos:
        extra = request.githubProfile or request.portfolioUrl
        usernames = extract_github_profile_usernames(request.resumeText, extra_url=extra)
        if request.githubProfile:
            bare = re.sub(r'^https?://(?:www\.)?github\.com/', '', request.githubProfile).strip('/')
            if bare and '/' not in bare and bare not in usernames:
                usernames.insert(0, bare)
        for username in usernames[:3]:
            profile_repos = await fetch_repos_from_profile(username, token=settings.github_token, max_repos=10)
            if profile_repos:
                found_repos = [{"name": r.name, "githubUrl": r.github_url, "confidence": r.confidence} for r in profile_repos]
                break

    # Last-resort fallback: use hardcoded URLs from config
    if not found_repos and settings.fallback_github_urls:
        logger.info(
            "discover_using_hardcoded_fallback_urls",
            candidate_id=request.candidateId,
            fallback_count=len(settings.fallback_github_urls),
        )
        found_repos = [
            {
                "name": url.rstrip("/").split("/")[-1].replace("-", " ").replace("_", " ").title(),
                "githubUrl": url,
                "confidence": 0.50,
            }
            for url in settings.fallback_github_urls
        ]

    logger.info("resume_discovery", candidate_id=request.candidateId, repos_found=len(found_repos))

    return ResumeDiscoveryResponse(
        candidateId=request.candidateId,
        projectsFound=len(found_repos),
        projects=[
            DiscoveredProject(
                name=r["name"],
                githubUrl=r["githubUrl"],
                confidence=r["confidence"],
                source="explicit_url",
            )
            for r in found_repos
        ],
        technologies=meta.get("technologies", []),
        message=f"Found {len(found_repos)} GitHub repositories in resume.",
    )


# ── 2. Full pipeline: discover → queue parallel analysis jobs ─────────────────

@router.post(
    "/analyze",
    response_model=ResumeToReportResponse,
    status_code=status.HTTP_202_ACCEPTED,
    dependencies=[Depends(verify_api_key)],
    summary="Parse resume, discover GitHub repos, dispatch parallel analysis",
)
async def analyze_from_resume(
    request: ResumeToReportRequest,
    db: AsyncSession = Depends(get_db),
) -> ResumeToReportResponse:
    """
    One-shot endpoint:
    1. Extract GitHub repos from resume text
    2. Create one AnalysisJob per repo
    3. Dispatch all jobs as a Celery group (parallel workers)
    4. Return a groupId to poll via GET /api/v1/resume/group/{groupId}
    """
    repos = extract_github_repos(request.resumeText)

    if not repos:
        # Fall back: discover repos via GitHub profile API
        # Use githubProfile field first, then portfolioUrl, then scan resume text
        extra = request.githubProfile or request.portfolioUrl
        usernames = extract_github_profile_usernames(
            request.resumeText, extra_url=extra
        )
        # If githubProfile is a bare username (not a URL), add it directly
        if request.githubProfile:
            bare = re.sub(r'^https?://(?:www\.)?github\.com/', '', request.githubProfile).strip('/')
            if bare and '/' not in bare and bare not in usernames:
                usernames.insert(0, bare)

        logger.info(
            "github_profile_fallback_attempt",
            candidate_id=request.candidateId,
            github_profile=request.githubProfile,
            usernames_found=usernames,
        )

        for username in usernames[:3]:
            profile_repos = await fetch_repos_from_profile(
                username, token=settings.github_token, max_repos=10
            )
            repos.extend(profile_repos)
            if repos:
                break

        if repos:
            logger.info(
                "github_profile_fallback_success",
                candidate_id=request.candidateId,
                repos_found=len(repos),
            )

    # Last-resort fallback: use the hardcoded FALLBACK_GITHUB_URLS from config
    if not repos and settings.fallback_github_urls:
        logger.info(
            "using_hardcoded_fallback_urls",
            candidate_id=request.candidateId,
            fallback_count=len(settings.fallback_github_urls),
        )
        from app.services.github_discovery import DiscoveredProject as _DP, _humanize_repo_name
        repos = [
            _DP(
                name=_humanize_repo_name(url.rstrip("/").split("/")[-1]),
                github_url=url,
                confidence=0.50,
                source="config_fallback",
            )
            for url in settings.fallback_github_urls
        ]

    if not repos:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=(
                "No GitHub repositories found in the resume and no fallback URLs configured. "
                "Include explicit repo URLs (e.g. github.com/user/repo) "
                "or set FALLBACK_GITHUB_URLS in your environment."
            ),
        )

    group_id = str(uuid.uuid4())
    job_ids: List[str] = []

    # Create a DB row for every discovered repo
    for repo in repos:
        job = AnalysisJob(
            id=uuid.uuid4(),
            candidate_id=request.candidateId,
            github_url=repo.github_url,
            resume_text=request.resumeText,
            status=JobStatus.QUEUED,
            # Store group membership in existing metadata column if present,
            # otherwise we query by candidate_id when building group status.
        )
        db.add(job)
        job_ids.append(str(job.id))

    await db.commit()

    # Dispatch all jobs as parallel Celery tasks
    task_group = celery_group(
        run_analysis.s(job_id)
        for job_id in job_ids
    )
    group_result = task_group.apply_async()

    logger.info(
        "multi_analysis_dispatched",
        group_id=group_id,
        candidate_id=request.candidateId,
        repo_count=len(repos),
        job_ids=job_ids,
    )

    return ResumeToReportResponse(
        candidateId=request.candidateId,
        groupId=group_id,
        projectsDiscovered=len(repos),
        projectsQueued=len(job_ids),
        discoveredProjects=[
            DiscoveredProject(
                name=r.name,
                githubUrl=r.github_url,
                confidence=r.confidence,
                source=r.source,
            )
            for r in repos
        ],
        pollUrl=f"/api/v1/resume/group/{group_id}?candidateId={request.candidateId}",
        message=(
            f"Discovered {len(repos)} repositories. "
            f"{len(job_ids)} parallel analysis jobs dispatched. "
            f"Poll {f'/api/v1/resume/group/{group_id}'} for status."
        ),
    )


# ── 3. Group status polling ───────────────────────────────────────────────────

@router.get(
    "/group/{group_id}",
    response_model=GroupStatusResponse,
    dependencies=[Depends(verify_api_key)],
    summary="Poll aggregate status of all parallel analysis jobs for a candidate",
)
async def get_group_status(
    group_id: str,
    candidateId: str,
    db: AsyncSession = Depends(get_db),
) -> GroupStatusResponse:
    """
    Returns the current status of all parallel analysis jobs for a candidate.
    Includes per-project scores and aggregated candidate trust score when complete.
    """
    rows = await db.execute(
        select(AnalysisJob).where(AnalysisJob.candidate_id == candidateId)
    )
    jobs = rows.scalars().all()

    if not jobs:
        raise HTTPException(status_code=404, detail="No analysis jobs found for this candidate")

    project_statuses: List[ProjectStatus] = []
    trust_scores = []
    auth_scores = []
    arch_scores = []

    for job in jobs:
        trust = None
        auth = None
        arch = None
        risk = None
        claims_verified = None
        total_claims = None
        claim_verification = []
        languages: dict = {}
        technologies: List[str] = []
        files: int | None = None
        lines_of_code: int | None = None
        commit_count: int | None = None

        if job.status == JobStatus.COMPLETED:
            # ── Scores ──────────────────────────────────────────
            res_row = await db.execute(
                select(AnalysisResult).where(AnalysisResult.analysis_id == job.id)
            )
            res = res_row.scalar_one_or_none()
            if res:
                trust = round(res.trust_score, 1)
                auth = round(res.authenticity_score, 1)
                arch = round(res.architecture_score, 1)
                risk = res.risk_level
                trust_scores.append(trust)
                auth_scores.append(auth)
                arch_scores.append(arch)

                # ── Claim results ────────────────────────────────
                claim_rows = await db.execute(
                    select(ClaimResult).where(ClaimResult.analysis_result_id == res.id)
                )
                claims = claim_rows.scalars().all()
                total_claims = len(claims)
                claims_verified = sum(1 for c in claims if c.verified)

                def _claim_status(c: ClaimResult) -> str:
                    if c.verified:
                        return "verified"
                    if c.confidence >= 50:
                        return "partial"
                    return "failed"

                claim_verification = [
                    ClaimVerificationItem(
                        claim=c.claim,
                        status=_claim_status(c),
                        confidence=round(c.confidence, 1),
                        reasoning=c.reasoning or "",
                        evidence=c.evidence or [],
                    )
                    for c in claims
                ]

            # ── Repo metadata ────────────────────────────────────
            meta_row = await db.execute(
                select(RepositoryMetadata).where(RepositoryMetadata.analysis_id == job.id)
            )
            meta = meta_row.scalar_one_or_none()
            if meta:
                languages = meta.languages or {}
                technologies = meta.frameworks or []
                files = meta.file_count or None

        project_statuses.append(ProjectStatus(
            analysisId=str(job.id),
            projectName=_repo_name_from_url(job.github_url),
            githubUrl=job.github_url,
            status=job.status.value,
            trustScore=trust,
            authenticityScore=auth,
            architectureScore=arch,
            riskLevel=risk,
            claimsVerified=claims_verified,
            totalClaims=total_claims,
            errorMessage=job.error_message,
            claimVerification=claim_verification,
            languages=languages,
            technologies=technologies,
            files=files,
            linesOfCode=lines_of_code,
            commitCount=commit_count,
        ))

    # Aggregate unique skills across all completed projects
    seen: set[str] = set()
    aggregated_skills: list[str] = []
    for ps in project_statuses:
        for tech in ps.technologies:
            if tech not in seen:
                seen.add(tech)
                aggregated_skills.append(tech)

    # Best-effort candidate name: extract from resume text if available
    candidate_name = candidateId
    if jobs and jobs[0].resume_text:
        import re as _re
        m = _re.search(r'^([A-Z][a-z]+(?: [A-Z][a-z]+)+)', jobs[0].resume_text.strip(), _re.MULTILINE)
        if m:
            candidate_name = m.group(1)

    completed = sum(1 for j in jobs if j.status == JobStatus.COMPLETED)
    failed = sum(1 for j in jobs if j.status == JobStatus.FAILED)
    pending = len(jobs) - completed - failed

    if completed == 0 and failed == 0:
        overall_status = "pending"
    elif pending > 0:
        overall_status = "in_progress"
    elif failed > 0 and completed > 0:
        overall_status = "partial_failure"
    elif failed == len(jobs):
        overall_status = "failed"
    else:
        overall_status = "completed"

    aggregated = None
    if trust_scores:
        avg_trust = round(sum(trust_scores) / len(trust_scores), 1)
        avg_auth = round(sum(auth_scores) / len(auth_scores), 1) if auth_scores else 0.0
        risk = _aggregate_risk(avg_trust)
        aggregated = AggregatedScores(
            overallTrustScore=avg_trust,
            authenticityScore=avg_auth,
            riskLevel=risk,
            recommendation=_get_recommendation(avg_trust),
            projectCount=len(jobs),
            verifiedCount=completed,
        )

    now = datetime.now(timezone.utc)
    return GroupStatusResponse(
        groupId=group_id,
        candidateId=candidateId,
        candidateName=candidate_name,
        appliedRole="",
        aggregatedSkills=aggregated_skills,
        totalProjects=len(jobs),
        completedProjects=completed,
        failedProjects=failed,
        pendingProjects=pending,
        overallStatus=overall_status,
        projects=project_statuses,
        aggregated=aggregated,
        createdAt=min(j.created_at for j in jobs) if jobs else now,
        updatedAt=max(j.updated_at for j in jobs) if jobs else now,
    )


# ── Helpers ───────────────────────────────────────────────────────────────────

def _repo_name_from_url(url: str) -> str:
    import re
    m = re.search(r'github\.com/[\w.-]+/([\w.-]+)', url)
    if m:
        return re.sub(r'[-_]+', ' ', m.group(1)).title()
    return url.split('/')[-1]


def _aggregate_risk(trust: float) -> str:
    if trust >= 85:
        return "LOW"
    if trust >= 65:
        return "MEDIUM"
    return "HIGH"


def _get_recommendation(trust: float) -> str:
    if trust >= 90:
        return "Proceed to Technical Interview"
    if trust >= 75:
        return "Consider for Next Round"
    if trust >= 55:
        return "Requires Further Review"
    return "Not Recommended"
