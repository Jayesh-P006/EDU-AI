from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.whiteboard import router as whiteboard_router
from app.core.config import settings


app = FastAPI(
    title=settings.app_name,
    version="1.0.0",
    description="FastAPI backend for AI doubt solving with live whiteboard streaming.",
)

_config_origins = settings.cors_origin_list
_dev_origins = [
    "http://localhost:5174",
    "http://127.0.0.1:5174",
    "http://localhost:5173",
    "http://127.0.0.1:5173",
]
cors_origins = list(dict.fromkeys(_config_origins + _dev_origins))

app.add_middleware(
    CORSMiddleware,
    allow_origins=cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
async def health_check() -> dict[str, str]:
    return {"status": "ok"}


app.include_router(whiteboard_router)
