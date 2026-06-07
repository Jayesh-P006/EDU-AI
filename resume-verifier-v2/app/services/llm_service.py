"""
Central LangChain LLM integration.
Primary: Hugging Face Inference API
Fallback: Groq LLaMA 3.3 70B (used automatically when HuggingFace fails or is unconfigured)
All LLM calls go through this module so retry, fallback, and
structured-output logic is in one place.
"""

import json
import re
from typing import Optional, Type, TypeVar

from langchain_huggingface import ChatHuggingFace, HuggingFaceEndpoint
from langchain_core.messages import SystemMessage, HumanMessage
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


def _build_hf_llm(model: str, temperature: float = 0.1) -> ChatHuggingFace:
    endpoint = HuggingFaceEndpoint(
        repo_id=model,
        huggingfacehub_api_token=settings.huggingface_api_key,
        task="text-generation",
        temperature=temperature,
        max_new_tokens=4096,
    )
    return ChatHuggingFace(llm=endpoint)


def _build_custom_llm(temperature: float = 0.1) -> ChatHuggingFace:
    """Builds the custom fine-tuned model client (settings.huggingface_custom_model).

    Reserved for future integration — not part of the active fallback chain yet.
    """
    return _build_hf_llm(settings.huggingface_custom_model, temperature=temperature)


def _build_groq_llm(temperature: float = 0.1):
    from langchain_groq import ChatGroq
    return ChatGroq(
        model=settings.groq_model,
        api_key=settings.groq_api_key,
        temperature=temperature,
        max_tokens=4096,
    )


class LLMService:
    """
    Facade over LangChain LLMs.
    Primary:  Hugging Face (pro or default model depending on use_pro flag)
    Fallback: Groq LLaMA 3.3 70B — kicks in when HuggingFace is unconfigured or raises
    """

    async def call_structured(
        self,
        system_prompt: str,
        user_prompt: str,
        output_model: Type[T],
        use_pro: bool = False,
    ) -> Optional[T]:
        if not settings.is_llm_configured:
            return None
        schema = json.dumps(output_model.model_json_schema(), indent=2)
        enhanced_prompt = (
            f"{user_prompt}\n\nRespond ONLY with valid JSON matching this schema:\n{schema}"
        )
        messages = [
            SystemMessage(content=system_prompt),
            HumanMessage(content=enhanced_prompt),
        ]
        text = await self._invoke_with_fallback(messages, use_pro=use_pro)
        if text:
            parsed = self._extract_json(text)
            if parsed:
                try:
                    return output_model(**parsed)
                except Exception as exc:
                    logger.warning("structured_parse_failed", error=str(exc))
        return None

    async def call_json(
        self,
        system_prompt: str,
        user_prompt: str,
        use_pro: bool = False,
    ) -> Optional[dict]:
        if not settings.is_llm_configured:
            return None
        messages = [
            SystemMessage(content=system_prompt),
            HumanMessage(content=f"{user_prompt}\n\nRespond ONLY with valid JSON."),
        ]
        text = await self._invoke_with_fallback(messages, use_pro=use_pro)
        if text:
            return self._extract_json(text)
        return None

    async def call_text(
        self,
        system_prompt: str,
        user_prompt: str,
        use_pro: bool = False,
    ) -> Optional[str]:
        if not settings.is_llm_configured:
            return None
        messages = [
            SystemMessage(content=system_prompt),
            HumanMessage(content=user_prompt),
        ]
        return await self._invoke_with_fallback(messages, use_pro=use_pro)

    async def _invoke_with_fallback(self, messages, use_pro: bool = False) -> Optional[str]:
        """Try HuggingFace first; fall back to Groq on failure or if unconfigured."""
        # Primary: HuggingFace
        if settings.is_huggingface_configured:
            try:
                model = settings.huggingface_pro_model if use_pro else settings.huggingface_model
                llm = _build_hf_llm(model)
                response = await self._raw_invoke(llm, messages)
                text = response.content if hasattr(response, "content") else str(response)
                if text:
                    logger.debug("llm_hf_success", use_pro=use_pro)
                    return text
            except Exception as exc:
                logger.warning("hf_llm_failed_trying_groq", use_pro=use_pro, error=str(exc))

        # Fallback: Groq LLaMA 3.3 70B
        if settings.is_groq_configured:
            try:
                llm = _build_groq_llm()
                response = await self._raw_invoke(llm, messages)
                text = response.content if hasattr(response, "content") else str(response)
                if text:
                    logger.info("llm_groq_fallback_used", use_pro=use_pro)
                    return text
            except Exception as exc:
                logger.warning("groq_llm_failed", use_pro=use_pro, error=str(exc))

        return None

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
        try:
            return json.loads(text)
        except json.JSONDecodeError:
            pass
        m = re.search(r"```(?:json)?\s*(\{.*?\})\s*```", text, re.DOTALL)
        if m:
            try:
                return json.loads(m.group(1))
            except json.JSONDecodeError:
                pass
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
