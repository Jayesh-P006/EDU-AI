from functools import lru_cache
from typing import Optional
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )

    # App
    app_name: str = "resume-verifier"
    app_env: str = "development"
    debug: bool = False
    secret_key: str = "change-me-in-production"
    api_key: str = "change-me-in-production"

    # Database
    database_url: str = "postgresql+asyncpg://postgres:password@localhost:5432/resume_verifier_v2"
    sync_database_url: str = "postgresql://postgres:password@localhost:5432/resume_verifier_v2"

    # Redis / Celery
    redis_url: str = "redis://localhost:6379/0"
    celery_broker_url: str = "redis://localhost:6379/0"
    celery_result_backend: str = "redis://localhost:6379/1"

    # Gemini
    gemini_api_key: str = ""
    gemini_pro_model: str = "gemini-2.5-pro"
    gemini_flash_model: str = "gemini-2.5-flash"

    # GitHub
    github_token: Optional[str] = None
    max_repo_size_mb: int = 500
    download_timeout_seconds: int = 120

    # Worker
    celery_concurrency: int = 4
    analysis_timeout_seconds: int = 600

    # LLM Retry
    llm_max_retries: int = 3
    llm_retry_delay: int = 2

    @property
    def max_repo_size_bytes(self) -> int:
        return self.max_repo_size_mb * 1024 * 1024

    @property
    def is_gemini_configured(self) -> bool:
        return bool(self.gemini_api_key)


@lru_cache()
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
