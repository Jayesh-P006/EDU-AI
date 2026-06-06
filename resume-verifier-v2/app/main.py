from contextlib import asynccontextmanager
from typing import AsyncGenerator

import structlog
from fastapi import FastAPI, Request, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.api import analyze, report, health
from app.core.config import settings
from app.core.database import init_db, close_db
from app.utils.logging import configure_logging

configure_logging()
logger = structlog.get_logger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncGenerator:
    logger.info("startup", service=settings.app_name, env=settings.app_env)
    await init_db()
    # Pre-compile the LangGraph workflow at startup
    from app.graph.workflow import get_compiled_workflow
    get_compiled_workflow()
    yield
    await close_db()
    logger.info("shutdown", service=settings.app_name)


app = FastAPI(
    title="Resume Verification Microservice v2",
    description=(
        "Production-grade GitHub repository verification engine powered by "
        "LangGraph + LangChain + Gemini. Verifies whether resume claims exist "
        "in the candidate's codebase with evidence-based LLM reasoning."
    ),
    version="2.0.0",
    docs_url="/docs" if settings.debug else None,
    redoc_url="/redoc" if settings.debug else None,
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception) -> JSONResponse:
    logger.exception("unhandled_exception", path=str(request.url), error=str(exc))
    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content={"detail": "Internal server error"},
    )


app.include_router(health.router)
app.include_router(analyze.router)
app.include_router(report.router)
