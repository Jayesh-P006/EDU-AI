"""
Central LangChain + Gemini integration.
All LLM calls go through this module so retry, fallback, and
structured-output logic is in one place.
"""

import json
import re
from typing import Any, Optional, Type, TypeVar

from langchain_google_genai import ChatGoogleGenerativeAI
from langchain_core.messages import SystemMessage, HumanMessage
from langchain_core.output_parsers import JsonOutputParser
from pydantic import BaseModel
from tenacity import (
    retry,
    stop_after_attempt,
    wait_exponential,
    retry_if_exception_type,
)
import structlog

from app.core.config import settings

logger = structlog.get_logger(__name__)

T = TypeVar("T", bound=BaseModel)

_UNAVAILABLE_ERRORS = (Exception,)  # broad catch — Gemini SDK raises various types


def _build_llm(model: str, temperature: float = 0.1) -> ChatGoogleGenerativeAI:
    return ChatGoogleGenerativeAI(
        model=model,
        google_api_key=settings.gemini_api_key,
        temperature=temperature,
        convert_system_message_to_human=False,
    )


def _pro_llm() -> ChatGoogleGenerativeAI:
    return _build_llm(settings.gemini_pro_model)


def _flash_llm() -> ChatGoogleGenerativeAI:
    return _build_llm(settings.gemini_flash_model)


class LLMService:
    """
    Facade over LangChain / Gemini.
    Pro model  → deep reasoning (authenticity, complex verification)
    Flash model → fast tasks (claim extraction, simple verification, report text)
    """

    # ── Structured JSON calls ────────────────────────────────────────────────

    async def call_structured(
        self,
        system_prompt: str,
        user_prompt: str,
        output_model: Type[T],
        use_pro: bool = False,
    ) -> Optional[T]:
        if not settings.is_gemini_configured:
            return None
        llm = _pro_llm() if use_pro else _flash_llm()
        structured = llm.with_structured_output(output_model)
        try:
            return await self._invoke_with_retry(structured, system_prompt, user_prompt)
        except Exception as exc:
            logger.warning("structured_call_failed", model=use_pro, error=str(exc))
            return None

    async def call_json(
        self,
        system_prompt: str,
        user_prompt: str,
        use_pro: bool = False,
    ) -> Optional[dict]:
        if not settings.is_gemini_configured:
            return None
        llm = _pro_llm() if use_pro else _flash_llm()
        parser = JsonOutputParser()
        try:
            messages = [
                SystemMessage(content=system_prompt),
                HumanMessage(content=f"{user_prompt}\n\nRespond ONLY with valid JSON."),
            ]
            response = await self._raw_invoke(llm, messages)
            text = response.content if hasattr(response, "content") else str(response)
            return self._extract_json(text)
        except Exception as exc:
            logger.warning("json_call_failed", use_pro=use_pro, error=str(exc))
            return None

    async def call_text(
        self,
        system_prompt: str,
        user_prompt: str,
        use_pro: bool = False,
    ) -> Optional[str]:
        if not settings.is_gemini_configured:
            return None
        llm = _pro_llm() if use_pro else _flash_llm()
        try:
            messages = [
                SystemMessage(content=system_prompt),
                HumanMessage(content=user_prompt),
            ]
            response = await self._raw_invoke(llm, messages)
            return response.content if hasattr(response, "content") else str(response)
        except Exception as exc:
            logger.warning("text_call_failed", use_pro=use_pro, error=str(exc))
            return None

    # ── Internal helpers ─────────────────────────────────────────────────────

    @retry(
        stop=stop_after_attempt(3),
        wait=wait_exponential(multiplier=1, min=2, max=10),
        retry=retry_if_exception_type(Exception),
        reraise=False,
    )
    async def _invoke_with_retry(self, chain, system_prompt: str, user_prompt: str):
        messages = [
            SystemMessage(content=system_prompt),
            HumanMessage(content=user_prompt),
        ]
        return await chain.ainvoke(messages)

    @retry(
        stop=stop_after_attempt(3),
        wait=wait_exponential(multiplier=1, min=2, max=10),
        retry=retry_if_exception_type(Exception),
        reraise=True,
    )
    async def _raw_invoke(self, llm, messages):
        return await llm.ainvoke(messages)

    @staticmethod
    def _extract_json(text: str) -> Optional[dict]:
        # Try direct parse
        try:
            return json.loads(text)
        except json.JSONDecodeError:
            pass
        # Try extracting JSON block
        m = re.search(r"```(?:json)?\s*(\{.*?\})\s*```", text, re.DOTALL)
        if m:
            try:
                return json.loads(m.group(1))
            except json.JSONDecodeError:
                pass
        # Try bare JSON object
        m = re.search(r"\{.*\}", text, re.DOTALL)
        if m:
            try:
                return json.loads(m.group())
            except json.JSONDecodeError:
                pass
        return None

    async def check_connectivity(self) -> bool:
        try:
            result = await self.call_text(
                "You are a test assistant.",
                "Reply with the single word: OK",
                use_pro=False,
            )
            return bool(result)
        except Exception:
            return False


def get_llm_service() -> LLMService:
    return LLMService()
