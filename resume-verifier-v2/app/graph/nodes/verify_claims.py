"""
Node 5 — Feature Verification
Hybrid approach: code-based evidence search + Gemini reasoning.
Sends actual code snippets to Gemini — not just file names.
"""

import asyncio
import re
from pathlib import Path
from typing import Any, Optional
import structlog

from app.graph.state import AnalysisState
from app.services.llm_service import get_llm_service

logger = structlog.get_logger(__name__)

IGNORE_DIRS = {
    ".git", "node_modules", "__pycache__", "venv", ".venv",
    "env", "dist", "build", ".next",
}
MAX_FILE_SIZE = 256 * 1024
MAX_SNIPPET_CHARS = 1500
MAX_EVIDENCE_FILES = 5

SYSTEM_PROMPT = """\
You are a senior software engineer performing code review for recruitment verification.
Your task: determine whether a claimed feature is GENUINELY implemented in the repository.

Assessment criteria:
- "deep": Full, production-quality implementation with error handling, edge cases, configuration
- "moderate": Working implementation with core functionality but missing some robustness
- "shallow": Minimal or scaffolded implementation (imported but barely used, placeholder code)
- "none": Referenced but not meaningfully implemented

Be strict. Importing a library is NOT sufficient — look for actual usage logic.\
"""

VERIFY_PROMPT = """\
Claim to verify: "{claim}"

Evidence from the repository:
{evidence}

Determine whether this claim is genuinely implemented.
Return JSON:
{{
  "verified": true/false,
  "confidence": 0-100,
  "depth": "deep|moderate|shallow|none",
  "reasoning": "concise explanation of what you found"
}}\
"""

# ── Feature pattern library ──────────────────────────────────────────────────

FEATURE_PATTERNS: dict[str, dict] = {
    "jwt": {
        "aliases": ["jwt", "json web token", "jwt authentication", "jwt auth"],
        "file_hints": ["auth", "jwt", "middleware", "token"],
        "code_patterns": [
            r"jsonwebtoken", r"jwt\.sign\(", r"jwt\.verify\(",
            r"PyJWT", r"from jose import", r"create_access_token",
            r"Bearer\s+", r"refresh.?token", r"jwt_required",
        ],
        "dep_hints": ["jsonwebtoken", "PyJWT", "python-jose", "jose"],
    },
    "redis": {
        "aliases": ["redis", "redis caching", "caching"],
        "file_hints": ["redis", "cache"],
        "code_patterns": [
            r"createClient\(", r"ioredis", r"\.set\(", r"\.get\(",
            r"from redis import", r"import redis", r"aioredis",
            r"RedisCache", r"CACHE_BACKEND",
        ],
        "dep_hints": ["redis", "ioredis", "aioredis"],
    },
    "docker": {
        "aliases": ["docker", "containerization", "docker deployment"],
        "file_names": ["Dockerfile", "docker-compose.yml", "docker-compose.yaml"],
        "code_patterns": [r"FROM\s+\w+", r"EXPOSE\s+\d+", r"ENTRYPOINT", r"CMD\s*\["],
        "dep_hints": [],
    },
    "rbac": {
        "aliases": ["rbac", "role-based access", "roles", "permissions"],
        "file_hints": ["role", "permission", "guard", "policy"],
        "code_patterns": [
            r"hasRole", r"isAdmin", r"checkPermission", r"@Roles\(",
            r"RolesGuard", r"PermissionGuard", r"user\.role",
        ],
        "dep_hints": ["casl", "accesscontrol"],
    },
    "socket.io": {
        "aliases": ["socket.io", "websocket", "websockets", "real-time", "realtime"],
        "file_hints": ["socket", "websocket", "gateway"],
        "code_patterns": [
            r"socket\.io", r"io\.on\(", r"socket\.emit\(",
            r"@WebSocketGateway", r"@SubscribeMessage",
            r"python-socketio", r"socketio\.AsyncServer",
        ],
        "dep_hints": ["socket.io", "python-socketio", "websockets"],
    },
    "graphql": {
        "aliases": ["graphql", "apollo", "graph api"],
        "file_hints": ["graphql", "resolver", "schema"],
        "code_patterns": [
            r"ApolloServer", r"gql`", r"typeDefs", r"resolvers",
            r"@strawberry", r"strawberry\.type", r"@ObjectType\(",
        ],
        "dep_hints": ["graphql", "apollo-server", "strawberry-graphql"],
    },
    "openai": {
        "aliases": ["openai", "gpt", "chatgpt"],
        "file_hints": ["openai", "ai", "llm"],
        "code_patterns": [
            r"OpenAI\(", r"openai\.ChatCompletion",
            r"client\.chat\.completions\.create",
            r"from openai import",
        ],
        "dep_hints": ["openai"],
    },
    "langchain": {
        "aliases": ["langchain", "langchain framework"],
        "file_hints": ["langchain", "chain", "llm"],
        "code_patterns": [
            r"from langchain", r"LLMChain", r"ChatOpenAI",
            r"PromptTemplate", r"ConversationChain",
        ],
        "dep_hints": ["langchain", "langchain-core"],
    },
    "langgraph": {
        "aliases": ["langgraph", "agentic workflow", "agent graph"],
        "file_hints": ["graph", "workflow", "agent"],
        "code_patterns": [
            r"from langgraph", r"StateGraph", r"add_node",
            r"add_edge", r"compile\(\)",
        ],
        "dep_hints": ["langgraph"],
    },
    "vector search": {
        "aliases": ["vector search", "pinecone", "chromadb", "embeddings", "rag", "semantic search"],
        "file_hints": ["vector", "embed", "rag", "pinecone", "chroma"],
        "code_patterns": [
            r"pinecone", r"chromadb", r"Chroma\(", r"FAISS",
            r"similarity_search", r"embed_query", r"HuggingFaceEmbeddings",
            r"OpenAIEmbeddings",
        ],
        "dep_hints": ["pinecone", "chromadb", "faiss-cpu"],
    },
    "oauth": {
        "aliases": ["oauth", "oauth2", "social login", "google auth"],
        "file_hints": ["oauth", "google", "facebook", "social"],
        "code_patterns": [
            r"passport\.use", r"OAuth2Strategy", r"GoogleStrategy",
            r"authorization_code", r"access_token.*oauth",
        ],
        "dep_hints": ["passport-google-oauth20", "authlib"],
    },
    "payment": {
        "aliases": ["stripe", "payment gateway", "payment integration", "paypal"],
        "file_hints": ["payment", "stripe", "billing"],
        "code_patterns": [
            r"stripe\.PaymentIntent", r"stripe\.checkout",
            r"paymentIntent\.create", r"webhook.*stripe",
        ],
        "dep_hints": ["stripe"],
    },
    "postgresql": {
        "aliases": ["postgresql", "postgres", "sql database"],
        "code_patterns": [
            r"pg\.Pool", r"psycopg2", r"asyncpg",
            r"createPool\(", r"DATABASE_URL.*postgres",
        ],
        "dep_hints": ["pg", "psycopg2", "asyncpg"],
    },
    "mongodb": {
        "aliases": ["mongodb", "mongo", "nosql", "mongoose"],
        "code_patterns": [
            r"mongoose\.connect", r"mongoose\.model",
            r"mongodb\+srv", r"MongoClient",
        ],
        "dep_hints": ["mongoose", "mongodb", "pymongo"],
    },
    "microservices": {
        "aliases": ["microservices", "microservice architecture"],
        "code_patterns": [r"docker-compose", r"grpc", r"RabbitMQ", r"kafka"],
        "dep_hints": ["grpc", "kafkajs", "amqplib"],
    },
    "ci/cd": {
        "aliases": ["ci/cd", "continuous integration", "github actions", "pipeline"],
        "file_names": [".github/workflows", "Jenkinsfile", ".gitlab-ci.yml"],
        "code_patterns": [r"on:\s+push", r"stages:", r"pipeline {"],
        "dep_hints": [],
    },
    "rate limiting": {
        "aliases": ["rate limiting", "throttle", "rate limit"],
        "code_patterns": [
            r"rateLimit\(", r"express-rate-limit", r"ThrottlerGuard",
            r"slowapi", r"@Throttle\(",
        ],
        "dep_hints": ["express-rate-limit", "slowapi", "@nestjs/throttler"],
    },
    "authentication": {
        "aliases": ["authentication", "login", "auth system", "user auth"],
        "file_hints": ["auth", "login", "signup"],
        "code_patterns": [
            r"bcrypt", r"hash\(", r"compare\(", r"passport",
            r"authenticate\(", r"login\(",
        ],
        "dep_hints": ["bcrypt", "passport", "argon2", "passlib"],
    },
}


class ClaimVerifier:
    def __init__(self, repo_root: Path, ast_data: dict, repo_metadata: dict) -> None:
        self.root = repo_root
        self.ast = ast_data
        self.repo = repo_metadata
        self._file_list: list[Path] = list(self._collect_files())

    def _collect_files(self):
        for p in self.root.rglob("*"):
            if p.is_dir():
                continue
            parts = p.relative_to(self.root).parts
            if any(part in IGNORE_DIRS for part in parts):
                continue
            yield p

    def find_evidence(self, claim: str) -> list[dict]:
        claim_lower = claim.lower()
        pattern_key = self._match_pattern(claim_lower)

        evidence: list[dict] = []

        if pattern_key:
            cfg = FEATURE_PATTERNS[pattern_key]
            evidence.extend(self._search_file_names(cfg))
            evidence.extend(self._search_deps(cfg))
            evidence.extend(self._search_code(cfg))
        else:
            evidence.extend(self._generic_search(claim))

        # Deduplicate by file, keep MAX_EVIDENCE_FILES
        seen: set[str] = set()
        dedup: list[dict] = []
        for e in evidence:
            if e["file"] not in seen:
                seen.add(e["file"])
                dedup.append(e)
        return dedup[:MAX_EVIDENCE_FILES]

    def _match_pattern(self, claim_lower: str) -> Optional[str]:
        for key, cfg in FEATURE_PATTERNS.items():
            aliases = cfg.get("aliases", [key])
            if any(a.lower() in claim_lower or claim_lower in a.lower() for a in aliases):
                return key
        return None

    def _search_file_names(self, cfg: dict) -> list[dict]:
        found = []
        for fname in cfg.get("file_names", []):
            for p in self._file_list:
                rel = str(p.relative_to(self.root))
                if fname.lower() in rel.lower():
                    snippet = self._read_snippet(p)
                    found.append({"file": rel, "reason": f"File '{fname}' present", "snippet": snippet})
        return found

    def _search_deps(self, cfg: dict) -> list[dict]:
        found = []
        all_deps: list[str] = []
        for dep_list in self.repo.get("dependencies", {}).values():
            all_deps.extend(dep_list)
        for hint in cfg.get("dep_hints", []):
            matches = [d for d in all_deps if hint.lower() in d.lower()]
            for m in matches[:2]:
                found.append({"file": "dependencies (package.json/requirements.txt)", "reason": f"Package '{m}' installed", "snippet": None})
        return found

    def _search_code(self, cfg: dict) -> list[dict]:
        file_hints = cfg.get("file_hints", [])
        code_patterns = cfg.get("code_patterns", [])

        candidate_files = (
            [p for p in self._file_list if any(h in p.name.lower() or h in str(p.relative_to(self.root)).lower() for h in file_hints)]
            if file_hints else []
        )
        if not candidate_files:
            candidate_files = [
                p for p in self._file_list
                if p.suffix.lower() in (".py", ".js", ".ts", ".jsx", ".tsx", ".yaml", ".yml")
            ]

        found = []
        for p in candidate_files[:80]:
            try:
                if p.stat().st_size > MAX_FILE_SIZE:
                    continue
                content = p.read_text(encoding="utf-8", errors="ignore")
                rel = str(p.relative_to(self.root))
                for pat in code_patterns:
                    m = re.search(pat, content, re.IGNORECASE | re.MULTILINE)
                    if m:
                        start = max(0, m.start() - 100)
                        end = min(len(content), m.end() + 200)
                        snippet = content[start:end].strip()[:MAX_SNIPPET_CHARS]
                        line_num = content[:m.start()].count("\n") + 1
                        found.append({
                            "file": rel,
                            "line": line_num,
                            "reason": f"Pattern '{pat}' found",
                            "snippet": snippet,
                        })
                        break  # one match per file is enough
            except Exception:
                continue
        return found

    def _generic_search(self, claim: str) -> list[dict]:
        terms = [t for t in claim.lower().split() if len(t) > 3]
        found = []
        for p in self._file_list[:100]:
            try:
                if p.stat().st_size > MAX_FILE_SIZE:
                    continue
                content = p.read_text(encoding="utf-8", errors="ignore").lower()
                if any(term in content for term in terms):
                    full_content = p.read_text(encoding="utf-8", errors="ignore")
                    rel = str(p.relative_to(self.root))
                    found.append({
                        "file": rel,
                        "reason": f"Keyword '{claim}' found in file",
                        "snippet": full_content[:500],
                    })
                    if len(found) >= 3:
                        break
            except Exception:
                continue
        return found

    def _read_snippet(self, path: Path, max_chars: int = MAX_SNIPPET_CHARS) -> Optional[str]:
        try:
            return path.read_text(encoding="utf-8", errors="ignore")[:max_chars]
        except Exception:
            return None


def _format_evidence_for_llm(evidence: list[dict]) -> str:
    parts = []
    for e in evidence:
        part = f"--- File: {e['file']} ---"
        if e.get("reason"):
            part += f"\nReason: {e['reason']}"
        if e.get("line"):
            part += f" (line {e['line']})"
        if e.get("snippet"):
            part += f"\n```\n{e['snippet']}\n```"
        parts.append(part)
    return "\n\n".join(parts) if parts else "No specific code evidence found."


MAX_CLAIMS = 20          # cap to keep total time under ~30 s
CONCURRENCY = 6         # parallel Gemini Flash calls


async def _verify_one(
    claim: str,
    verifier: "ClaimVerifier",
    llm,
    sem: asyncio.Semaphore,
) -> dict:
    evidence = verifier.find_evidence(claim)

    if not evidence:
        return {
            "claim": claim, "verified": False, "confidence": 0,
            "depth": "none",
            "reasoning": "No evidence of this feature found in the repository",
            "evidence": [],
        }

    async with sem:
        evidence_text = _format_evidence_for_llm(evidence)
        llm_result = await llm.call_json(
            system_prompt=SYSTEM_PROMPT,
            user_prompt=VERIFY_PROMPT.format(claim=claim, evidence=evidence_text),
            use_pro=False,
        )

    if llm_result:
        result = {
            "claim": claim,
            "verified": bool(llm_result.get("verified", False)),
            "confidence": float(llm_result.get("confidence", 0)),
            "depth": llm_result.get("depth", "shallow"),
            "reasoning": llm_result.get("reasoning", ""),
            "evidence": [
                {"file": e["file"], "reason": e["reason"], "line": e.get("line"), "snippet": e.get("snippet")}
                for e in evidence
            ],
        }
    else:
        result = {
            "claim": claim,
            "verified": len(evidence) >= 2,
            "confidence": min(50.0, len(evidence) * 15.0),
            "depth": "shallow",
            "reasoning": f"Evidence found in {len(evidence)} file(s) — LLM unavailable",
            "evidence": [
                {"file": e["file"], "reason": e["reason"], "line": e.get("line"), "snippet": None}
                for e in evidence
            ],
        }

    logger.info(
        "claim_verified",
        claim=claim,
        verified=result["verified"],
        confidence=result["confidence"],
        depth=result["depth"],
    )
    return result


async def verify_claims_node(state: AnalysisState) -> dict[str, Any]:
    claims = state.get("claims", [])
    logger.info("node_verify_claims", analysis_id=state["analysis_id"], claim_count=len(claims))

    if not claims:
        return {"verification_results": [], "errors": ["No claims to verify"]}

    if not state.get("repo_path"):
        return {
            "verification_results": [
                {"claim": c, "verified": False, "confidence": 0, "depth": "none",
                 "reasoning": "Repository not available", "evidence": []}
                for c in claims
            ],
            "errors": [],
        }

    # Cap claims to avoid excessively long runs
    if len(claims) > MAX_CLAIMS:
        logger.info("claims_capped", original=len(claims), capped=MAX_CLAIMS)
        claims = claims[:MAX_CLAIMS]

    verifier = ClaimVerifier(
        Path(state["repo_path"]),
        state.get("ast_data", {}),
        state.get("repo_metadata", {}),
    )
    llm = get_llm_service()
    sem = asyncio.Semaphore(CONCURRENCY)

    # Run all claim verifications in parallel (bounded by semaphore)
    results = await asyncio.gather(
        *[_verify_one(claim, verifier, llm, sem) for claim in claims],
        return_exceptions=False,
    )

    return {"verification_results": list(results), "errors": []}
