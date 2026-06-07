"""
Node 6 — Authenticity Analysis
Uses Hugging Face Inference to perform deep architectural analysis.
Evaluates whether the project represents genuine engineering work.
"""

import random
import re
from pathlib import Path
from typing import Any
import structlog

from app.graph.state import AnalysisState
from app.services.llm_service import get_llm_service

logger = structlog.get_logger(__name__)

IGNORE_DIRS = {
    ".git", "node_modules", "__pycache__", "venv", ".venv",
    "env", "dist", "build", ".next",
}
MAX_SAMPLE_FILES = 12
MAX_FILE_CHARS = 2000
MAX_README_CHARS = 3000

SYSTEM_PROMPT = """\
You are a principal software architect with 15 years of experience reviewing candidate portfolios.

Evaluate whether this GitHub repository represents GENUINE, ORIGINAL engineering work.

Analyse critically:
1. **Architecture depth** — Are there real design decisions, proper layering, and separation of concerns?
2. **Feature completeness** — Are features fully implemented or just scaffolded/placeholder?
3. **Template/boilerplate indicators** — Signs of starter kits, copied tutorials, or auto-generated code
4. **Project maturity** — Is there evidence of iterative development, error handling, edge cases?
5. **Enterprise patterns** — Proper configuration management, logging, validation, security hardening
6. **Dead code / unused imports** — High ratio suggests lack of understanding
7. **Code coherence** — Does the code style, naming, and structure feel consistent and intentional?

Be strict and honest. A tutorial project should score low even if it works.\
"""

AUTHENTICITY_PROMPT = """\
Repository Analysis Package:

## Repository Metadata
{metadata_summary}

## Sampled Source Files
{code_samples}

## README Content
{readme_content}

## Dependency Analysis
{dependency_summary}

Based on this evidence, evaluate the repository's authenticity.

Return JSON:
{{
  "authenticityScore": 0-100,
  "riskLevel": "LOW|MEDIUM|HIGH",
  "reasoning": [
    "bullet point 1",
    "bullet point 2",
    ...
  ],
  "indicators": {{
    "architectureDepth": "shallow|moderate|deep",
    "templateRisk": "none|low|medium|high",
    "featureCompleteness": "partial|complete|enterprise",
    "projectMaturity": "beginner|intermediate|senior"
  }}
}}\
"""


def _sample_source_files(repo_root: Path) -> str:
    source_files = []
    for p in repo_root.rglob("*"):
        if p.is_dir():
            continue
        parts = p.relative_to(repo_root).parts
        if any(part in IGNORE_DIRS for part in parts):
            continue
        if p.suffix.lower() in (".py", ".js", ".ts", ".jsx", ".tsx"):
            source_files.append(p)

    # Prefer files in meaningful directories
    priority = [
        f for f in source_files
        if any(d in str(f).lower() for d in ("service", "controller", "middleware", "model", "auth", "core"))
    ]
    others = [f for f in source_files if f not in priority]
    random.shuffle(others)
    selected = (priority + others)[:MAX_SAMPLE_FILES]

    parts = []
    for p in selected:
        try:
            content = p.read_text(encoding="utf-8", errors="ignore")[:MAX_FILE_CHARS]
            rel = str(p.relative_to(repo_root))
            parts.append(f"### {rel}\n```\n{content}\n```")
        except Exception:
            continue
    return "\n\n".join(parts) if parts else "No source files available."


def _read_readme(repo_root: Path) -> str:
    for name in ("README.md", "readme.md", "README.txt"):
        p = repo_root / name
        if p.exists():
            try:
                return p.read_text(encoding="utf-8", errors="ignore")[:MAX_README_CHARS]
            except Exception:
                pass
    return "No README found."


def _format_metadata(repo_metadata: dict) -> str:
    langs = ", ".join(f"{k}: {v['percentage']}%" for k, v in list(repo_metadata.get("languages", {}).items())[:5])
    return (
        f"Files: {repo_metadata.get('fileCount', 0)} | "
        f"Folders: {repo_metadata.get('folderCount', 0)} | "
        f"Languages: {langs or 'unknown'} | "
        f"Frameworks: {', '.join(repo_metadata.get('frameworks', [])) or 'none'} | "
        f"Has tests: {repo_metadata.get('hasTests', False)} | "
        f"Has CI: {repo_metadata.get('hasCi', False)} | "
        f"Maturity indicators: {', '.join(repo_metadata.get('maturityIndicators', [])) or 'none'}"
    )


def _format_deps(repo_metadata: dict) -> str:
    lines = []
    for manager, pkgs in repo_metadata.get("dependencies", {}).items():
        lines.append(f"{manager}: {', '.join(pkgs[:20])}")
    return "\n".join(lines) if lines else "No dependencies detected."


def _heuristic_authenticity(repo_metadata: dict, ast_data: dict) -> dict:
    """Deterministic fallback when Gemini is unavailable."""
    score = 40.0  # baseline

    # Positive signals
    if repo_metadata.get("hasTests"):
        score += 10
    if repo_metadata.get("hasCi"):
        score += 8
    if len(repo_metadata.get("maturityIndicators", [])) > 2:
        score += 7
    if ast_data.get("services"):
        score += 8
    if ast_data.get("controllers"):
        score += 7
    if ast_data.get("middleware"):
        score += 5
    if ast_data.get("models"):
        score += 5

    fn_count = len(ast_data.get("functions", []))
    score += min(10, fn_count * 0.5)

    score = min(100.0, score)
    risk = "LOW" if score >= 70 else "MEDIUM" if score >= 45 else "HIGH"

    return {
        "authenticityScore": round(score, 1),
        "riskLevel": risk,
        "reasoning": ["HuggingFace unavailable — heuristic score based on repository structure"],
        "indicators": {
            "architectureDepth": "moderate" if score > 60 else "shallow",
            "templateRisk": "low" if score > 70 else "medium",
            "featureCompleteness": "complete" if score > 65 else "partial",
            "projectMaturity": "intermediate" if score > 55 else "beginner",
        },
    }


async def authenticity_node(state: AnalysisState) -> dict[str, Any]:
    logger.info("node_authenticity", analysis_id=state["analysis_id"])

    repo_metadata = state.get("repo_metadata", {})
    ast_data = state.get("ast_data", {})

    if not state.get("repo_path"):
        return {
            "authenticity_result": {
                "authenticityScore": 30,
                "riskLevel": "HIGH",
                "reasoning": ["Repository could not be downloaded"],
                "indicators": {},
            },
            "errors": [],
        }

    repo_root = Path(state["repo_path"])
    code_samples = _sample_source_files(repo_root)
    readme = _read_readme(repo_root)
    metadata_str = _format_metadata(repo_metadata)
    deps_str = _format_deps(repo_metadata)

    llm = get_llm_service()
    result = await llm.call_json(
        system_prompt=SYSTEM_PROMPT,
        user_prompt=AUTHENTICITY_PROMPT.format(
            metadata_summary=metadata_str,
            code_samples=code_samples,
            readme_content=readme,
            dependency_summary=deps_str,
        ),
        use_pro=True,  # Use Pro for deep reasoning
    )

    if result and "authenticityScore" in result:
        logger.info(
            "authenticity_complete",
            score=result.get("authenticityScore"),
            risk=result.get("riskLevel"),
        )
        return {"authenticity_result": result, "errors": []}

    # Fallback to heuristic
    fallback = _heuristic_authenticity(repo_metadata, ast_data)
    return {
        "authenticity_result": fallback,
        "errors": ["HuggingFace unavailable for authenticity analysis — used heuristic fallback"],
    }
