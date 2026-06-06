from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.whiteboard import router as whiteboard_router
from app.core.config import settings


app = FastAPI(
    title=settings.app_name,
    version="1.0.0",
    description="FastAPI backend for AI doubt solving with live whiteboard streaming.",
)

cors_origins = settings.cors_origin_list
app.add_middleware(
    CORSMiddleware,
    allow_origins=cors_origins,
    allow_credentials="*" not in cors_origins,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
async def health_check() -> dict[str, str]:
    return {"status": "ok"}


app.include_router(whiteboard_router)
