from functools import lru_cache
from typing import Optional, List
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

    # Hugging Face
    huggingface_custom_model: str = "dhruvchourey/eduai"

    # Groq (fallback LLM)
    groq_api_key: str = ""
    groq_model: str = "llama-3.3-70b-versatile"

    # GitHub
    github_token: Optional[str] = None
    max_repo_size_mb: int = 500
    download_timeout_seconds: int = 120

    # Fallback repo URLs — used when no GitHub links are found in the resume text.
    # Set via env as a comma-separated list: FALLBACK_GITHUB_URLS=url1,url2,...
    fallback_github_urls: List[str] = [
        "https://github.com/Navn2025/Recruit_AI",
        "https://github.com/Navn2025/AutoBot",
        "https://github.com/Navn2025/Ayurwell",
        "https://github.com/Navn2025/meetFlow-server",
    ]

    # Worker
    celery_concurrency: int = 4
    analysis_timeout_seconds: int = 600

    # LLM Retry
    llm_max_retries: int = 3
    llm_retry_delay: int = 2
    huggingface_api_key: str = ""
    huggingface_model: str = "meta-llama/Llama-3.2-11B-Vision-Instruct"
    huggingface_pro_model: str = "meta-llama/Llama-3.3-70B-Instruct"

    @property
    def max_repo_size_bytes(self) -> int:
        return self.max_repo_size_mb * 1024 * 1024

    @property
    def is_huggingface_configured(self) -> bool:
        return bool(self.huggingface_api_key)

    @property
    def is_groq_configured(self) -> bool:
        return bool(self.groq_api_key)

    @property
    def is_llm_configured(self) -> bool:
        return self.is_huggingface_configured or self.is_groq_configured


@lru_cache()
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
