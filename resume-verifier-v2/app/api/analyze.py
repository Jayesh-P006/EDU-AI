import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
import structlog

from app.core.database import get_db
from app.core.security import verify_api_key
from app.models.analysis import AnalysisJob, AnalysisResult, JobStatus
from app.schemas.analysis import AnalyzeRequest, AnalyzeResponse, AnalysisStatusResponse
from app.workers.analysis_worker import run_analysis

logger = structlog.get_logger(__name__)
router = APIRouter(prefix="/api/v1", tags=["analysis"])


@router.post(
    "/analyze",
    response_model=AnalyzeResponse,
    status_code=status.HTTP_202_ACCEPTED,
    dependencies=[Depends(verify_api_key)],
    summary="Submit a repository for verification",
)
async def submit_analysis(
    request: AnalyzeRequest,
    db: AsyncSession = Depends(get_db),
) -> AnalyzeResponse:
    job = AnalysisJob(
        id=uuid.uuid4(),
        candidate_id=request.candidateId,
        github_url=request.githubUrl,
        resume_text=request.resumeText,
        status=JobStatus.QUEUED,
    )
    db.add(job)
    await db.commit()
    await db.refresh(job)

    task = run_analysis.apply_async(
        args=[str(job.id)],
        task_id=str(uuid.uuid4()),
    )

    job.celery_task_id = task.id
    await db.commit()

    logger.info(
        "analysis_queued",
        analysis_id=str(job.id),
        candidate_id=request.candidateId,
        celery_task=task.id,
    )

    return AnalyzeResponse(
        analysisId=str(job.id),
        status=job.status.value,
        message="Analysis queued successfully. Poll GET /api/v1/analyze/{analysisId} for status.",
    )


@router.get(
    "/analyze/{analysis_id}",
    response_model=AnalysisStatusResponse,
    dependencies=[Depends(verify_api_key)],
    summary="Poll analysis status",
)
async def get_analysis_status(
    analysis_id: str,
    db: AsyncSession = Depends(get_db),
) -> AnalysisStatusResponse:
    try:
        uid = uuid.UUID(analysis_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid analysis ID format")

    job_row = await db.execute(select(AnalysisJob).where(AnalysisJob.id == uid))
    job = job_row.scalar_one_or_none()
    if not job:
        raise HTTPException(status_code=404, detail="Analysis not found")

    trust_score = None
    recommendation = None
    risk_level = None

    if job.status == JobStatus.COMPLETED:
        res_row = await db.execute(
            select(AnalysisResult).where(AnalysisResult.analysis_id == uid)
        )
        res = res_row.scalar_one_or_none()
        if res:
            trust_score = res.trust_score
            recommendation = res.recommendation
            risk_level = res.risk_level

    return AnalysisStatusResponse(
        analysisId=str(job.id),
        candidateId=job.candidate_id,
        status=job.status.value,
        trustScore=trust_score,
        recommendation=recommendation,
        riskLevel=risk_level,
        errorMessage=job.error_message,
        createdAt=job.created_at,
        updatedAt=job.updated_at,
    )
