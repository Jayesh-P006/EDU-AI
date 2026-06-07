from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import text
import redis.asyncio as aioredis
import structlog

from app.core.config import settings
from app.core.database import get_db
from app.schemas.analysis import HealthResponse
from app.services.llm_service import get_llm_service

router = APIRouter(tags=["health"])
logger = structlog.get_logger(__name__)


@router.get("/health", response_model=HealthResponse, summary="Service health check")
async def health(db: AsyncSession = Depends(get_db)) -> HealthResponse:
    db_status = "ok"
    redis_status = "ok"
    huggingface_status = "ok"

    try:
        await db.execute(text("SELECT 1"))
    except Exception as exc:
        db_status = f"error: {exc}"

    try:
        r = aioredis.from_url(settings.redis_url, socket_connect_timeout=2)
        await r.ping()
        await r.aclose()
    except Exception as exc:
        redis_status = f"error: {exc}"

    if not settings.is_huggingface_configured:
        huggingface_status = "not_configured"
    else:
        try:
            llm = get_llm_service()
            ok = await llm.check_connectivity()
            huggingface_status = "ok" if ok else "error: no response"
        except Exception as exc:
            huggingface_status = f"error: {exc}"

    overall = (
        "ok"
        if db_status == "ok" and redis_status == "ok"
        else "degraded"
    )

    return HealthResponse(
        status=overall,
        service="resume-verifier-v2",
        database=db_status,
        redis=redis_status,
        huggingface=huggingface_status,
    )
