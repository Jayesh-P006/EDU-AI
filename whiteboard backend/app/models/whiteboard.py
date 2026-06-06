from typing import Any, Literal

from pydantic import BaseModel, Field


class ChatMessage(BaseModel):
    role: Literal["user", "assistant", "model"] = "user"
    content: str = Field(..., min_length=1)


class SolveRequest(BaseModel):
    question: str = Field(..., min_length=1)
    subject: str = Field(default="General", min_length=1)
    history: list[ChatMessage] = Field(default_factory=list)


class SaveWhiteboardRequest(BaseModel):
    session_id: str | None = Field(default=None, alias="sessionId")
    question: str | None = None
    elements: list[dict[str, Any]] = Field(default_factory=list)
    chat_history: list[dict[str, Any]] = Field(default_factory=list, alias="chatHistory")

    model_config = {"populate_by_name": True}
