from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    app_name: str = "EDU-AI Whiteboard API"
    frontend_url: str = "http://localhost:5173"
    cors_origins: str = Field(default="http://localhost:5173,http://127.0.0.1:5173")
    groq_api_key: str | None = None
    groq_api_base: str = "https://api.groq.com/openai/v1"
    groq_model: str = "llama-3.3-70b-versatile"
    allow_demo_fallback: bool = True
    max_history_messages: int = 12

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    @property
    def cors_origin_list(self) -> list[str]:
        origins = [origin.strip() for origin in self.cors_origins.split(",") if origin.strip()]
        return origins or [self.frontend_url]


settings = Settings()
