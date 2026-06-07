"""
Node 1 — Claim Extraction
Extracts verifiable technical claims from the resume using Hugging Face Inference.
Falls back to regex keyword matching when LLM is unavailable.
"""

import re
from typing import Any

from pydantic import BaseModel, Field
import structlog

from app.graph.state import AnalysisState
from app.services.llm_service import get_llm_service

logger = structlog.get_logger(__name__)

SYSTEM_PROMPT = """\
You are a senior technical recruiter assistant specialising in software engineering.
Your task is to extract all concrete, verifiable technical claims from a candidate's resume.

Focus ONLY on:
- Technologies and tools (JWT, Redis, Docker, Socket.IO, etc.)
- Frameworks and libraries (React, NestJS, LangChain, etc.)
- Architectural patterns (microservices, RBAC, GraphQL, REST API, etc.)
- Infrastructure capabilities (CI/CD, Kubernetes, cloud services, etc.)
- AI/ML capabilities (LLM integration, RAG, vector search, etc.)
- Security features (OAuth2, rate limiting, encryption, etc.)
- External integrations (payment gateways, third-party APIs, etc.)

Do NOT include: soft skills, team sizes, vague business metrics, or non-technical claims.\
"""

USER_PROMPT = """\
Resume text:
{resume_text}

Extract all technical claims. Return as JSON:
{{"claims": ["claim1", "claim2", ...]}}\
"""


class ClaimsOutput(BaseModel):
    claims: list[str] = Field(description="List of verifiable technical claims")


FALLBACK_KEYWORDS = [
    "JWT", "authentication", "OAuth", "OAuth2", "Redis", "caching",
    "Docker", "Kubernetes", "CI/CD", "GitHub Actions", "GraphQL",
    "REST API", "RESTful", "microservices", "WebSocket", "Socket.IO",
    "PostgreSQL", "MongoDB", "MySQL", "SQLite", "Elasticsearch",
    "React", "Next.js", "Vue", "Angular", "Node.js", "Express",
    "FastAPI", "Django", "Flask", "Spring Boot", "NestJS",
    "TypeScript", "Python", "Go", "Rust", "Java",
    "AWS", "GCP", "Azure", "Terraform", "Ansible", "Nginx",
    "RabbitMQ", "Kafka", "gRPC", "Prisma", "TypeORM", "SQLAlchemy",
    "OpenAI", "LangChain", "LangGraph", "Pinecone", "ChromaDB",
    "embeddings", "vector search", "RAG", "LLM",
    "RBAC", "rate limiting", "load balancing", "SSL/TLS",
    "unit tests", "integration tests", "TDD", "Jest", "pytest",
    "Stripe", "PayPal", "Twilio", "SendGrid",
    "WebRTC", "FFmpeg", "S3", "CDN",
]


async def extract_claims_node(state: AnalysisState) -> dict[str, Any]:
    logger.info("node_extract_claims", analysis_id=state["analysis_id"])
    resume_text = state["resume_text"]

    llm = get_llm_service()

    # Try structured Gemini call
    result = await llm.call_structured(
        system_prompt=SYSTEM_PROMPT,
        user_prompt=USER_PROMPT.format(resume_text=resume_text[:8000]),
        output_model=ClaimsOutput,
        use_pro=False,
    )

    if result and result.claims:
        claims = [c.strip() for c in result.claims if c.strip()]
        logger.info("claims_extracted_llm", count=len(claims))
        return {"claims": claims, "errors": []}

    # Fallback: regex keyword matching
    claims = _regex_extract(resume_text)
    logger.info("claims_extracted_fallback", count=len(claims))
    return {
        "claims": claims,
        "errors": ["HuggingFace unavailable for claim extraction — used regex fallback"],
    }


def _regex_extract(resume_text: str) -> list[str]:
    text_lower = resume_text.lower()
    found = []
    for kw in FALLBACK_KEYWORDS:
        if kw.lower() in text_lower:
            found.append(kw)
    return list(dict.fromkeys(found))
