import uuid

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
import structlog

from app.core.database import get_db
from app.core.security import verify_api_key
from app.models.analysis import (
    AnalysisJob, AnalysisResult, ClaimResult,
    VerificationReport, JobStatus,
)
from app.schemas.analysis import (
    ReportResponse, ClaimVerificationResult, EvidenceItem,
    RepositorySummary, CodeMetrics, AuthenticityIndicators, ScoreBreakdown,
)

logger = structlog.get_logger(__name__)
router = APIRouter(prefix="/api/v1", tags=["reports"])


def _build_claim(c: ClaimResult) -> ClaimVerificationResult:
    return ClaimVerificationResult(
        claim=c.claim,
        verified=c.verified,
        confidence=c.confidence,
        depth=c.depth,
        reasoning=c.reasoning,
        evidence=[
            EvidenceItem(
                file=e.get("file", ""),
                line=e.get("line"),
                snippet=e.get("snippet"),
                reason=e.get("reason", ""),
            )
            for e in (c.evidence or [])
        ],
    )


def _build_repo_summary(raw: dict) -> RepositorySummary:
    return RepositorySummary(
        githubUrl=raw.get("githubUrl", ""),
        defaultBranch=raw.get("defaultBranch", "main"),
        fileCount=raw.get("fileCount", 0),
        folderCount=raw.get("folderCount", 0),
        totalSizeMB=raw.get("totalSizeMB", 0.0),
        languages=raw.get("languages", {}),
        frameworks=raw.get("frameworks", []),
        dependencies=raw.get("dependencies", {}),
        hasDockerfile=raw.get("hasDockerfile", False),
        hasDockerCompose=raw.get("hasDockerCompose", False),
        hasTests=raw.get("hasTests", False),
        hasReadme=raw.get("hasReadme", False),
        hasCi=raw.get("hasCi", False),
        maturityIndicators=raw.get("maturityIndicators", []),
    )


def _build_code_metrics(ast_metadata: dict) -> CodeMetrics:
    return CodeMetrics(
        functionCount=len(ast_metadata.get("functions", [])),
        classCount=len(ast_metadata.get("classes", [])),
        routeCount=len(ast_metadata.get("routes", [])),
        serviceCount=len(ast_metadata.get("services", [])),
        controllerCount=len(ast_metadata.get("controllers", [])),
        modelCount=len(ast_metadata.get("models", [])),
        middlewareCount=len(ast_metadata.get("middleware", [])),
    )


def _build_score_breakdown(ar: AnalysisResult) -> ScoreBreakdown:
    return ScoreBreakdown(
        featureVerification=ar.feature_verification_score,
        architecture=ar.architecture_score,
        codeQuality=ar.quality_score,
        security=ar.security_score,
        authenticity=ar.authenticity_score,
    )


def _build_authenticity_indicators(raw: dict) -> AuthenticityIndicators:
    return AuthenticityIndicators(
        architectureDepth=raw.get("architectureDepth", "unknown"),
        templateRisk=raw.get("templateRisk", "unknown"),
        featureCompleteness=raw.get("featureCompleteness", "unknown"),
        projectMaturity=raw.get("projectMaturity", "unknown"),
    )


@router.get(
    "/report/{analysis_id}",
    response_model=ReportResponse,
    dependencies=[Depends(verify_api_key)],
    summary="Retrieve the full verification report",
)
async def get_report(
    analysis_id: str,
    db: AsyncSession = Depends(get_db),
) -> ReportResponse:
    try:
        uid = uuid.UUID(analysis_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid analysis ID format")

    job_row = await db.execute(select(AnalysisJob).where(AnalysisJob.id == uid))
    job = job_row.scalar_one_or_none()
    if not job:
        raise HTTPException(status_code=404, detail="Analysis not found")

    if job.status in (JobStatus.QUEUED, JobStatus.PROCESSING):
        raise HTTPException(
            status_code=202,
            detail=f"Analysis is still {job.status.value}. Retry later.",
        )

    if job.status == JobStatus.FAILED:
        raise HTTPException(
            status_code=422,
            detail=f"Analysis failed: {job.error_message}",
        )

    rep_row = await db.execute(
        select(VerificationReport).where(VerificationReport.analysis_id == uid)
    )
    rep = rep_row.scalar_one_or_none()
    if not rep:
        raise HTTPException(status_code=404, detail="Report not yet available")

    ar_row = await db.execute(
        select(AnalysisResult).where(AnalysisResult.analysis_id == uid)
    )
    ar = ar_row.scalar_one_or_none()

    cr_row = await db.execute(
        select(ClaimResult)
        .join(AnalysisResult, ClaimResult.analysis_result_id == AnalysisResult.id)
        .where(AnalysisResult.analysis_id == uid)
        .order_by(ClaimResult.confidence.desc())
    )
    claims = cr_row.scalars().all()

    all_claim_results = [_build_claim(c) for c in claims]
    verified_claims = [r for r in all_claim_results if r.verified]
    missing_claim_names = [r.claim for r in all_claim_results if not r.verified]

    # ── Repository summary ───────────────────────────────────────────────────
    repo_summary_raw = rep.repository_summary or {}
    # full_report may carry richer data (dependencies, hasCi, etc.) than what
    # was stored in repository_summary alone
    full_report = rep.full_report or {}
    full_repo_raw = full_report.get("repositorySummary", {})
    merged_repo = {**full_repo_raw, **repo_summary_raw}
    repo_summary = _build_repo_summary(merged_repo) if merged_repo else None

    # ── Code metrics ─────────────────────────────────────────────────────────
    ast_metadata = (ar.ast_metadata or {}) if ar else {}
    # full_report also carries codeMetrics directly
    full_code_metrics = full_report.get("codeMetrics")
    if full_code_metrics:
        code_metrics = CodeMetrics(**full_code_metrics)
    elif ast_metadata:
        code_metrics = _build_code_metrics(ast_metadata)
    else:
        code_metrics = None

    # ── Authenticity indicators ──────────────────────────────────────────────
    indicators_raw = full_report.get("authenticityIndicators", {})
    auth_indicators = _build_authenticity_indicators(indicators_raw) if indicators_raw else None

    # ── Score breakdown ──────────────────────────────────────────────────────
    score_breakdown = _build_score_breakdown(ar) if ar else None

    # ── Analysis errors ──────────────────────────────────────────────────────
    graph_trace = (ar.graph_trace or {}) if ar else {}
    analysis_errors = graph_trace.get("errors", [])

    return ReportResponse(
        analysisId=str(uid),
        candidateId=job.candidate_id,
        repositorySummary=repo_summary,
        claimResults=all_claim_results,
        verifiedClaims=verified_claims,
        missingClaims=missing_claim_names,
        trustScore=rep.trust_score,
        qualityScore=rep.quality_score,
        authenticityScore=rep.authenticity_score,
        architectureScore=ar.architecture_score if ar else 0.0,
        securityScore=ar.security_score if ar else 0.0,
        featureVerificationScore=ar.feature_verification_score if ar else 0.0,
        scoreBreakdown=score_breakdown,
        recommendation=rep.recommendation,
        riskLevel=rep.risk_level,
        authenticityReasoning=ar.authenticity_reasoning if ar else [],
        authenticityIndicators=auth_indicators,
        codeMetrics=code_metrics,
        processingTimeSeconds=ar.processing_time_seconds if ar else 0.0,
        analysisErrors=analysis_errors,
        createdAt=rep.created_at,
    )
