"""Tests for individual LangGraph nodes (no LLM calls)."""

import json
import tempfile
from pathlib import Path
from unittest.mock import AsyncMock, patch

import pytest

from app.graph.state import AnalysisState
from app.graph.nodes.extract_claims import _regex_extract, extract_claims_node
from app.graph.nodes.scan_repo import scan_repo_node
from app.graph.nodes.ast_analysis import ast_analysis_node
from app.graph.nodes.score import score_node
from app.graph.nodes.generate_report import generate_report_node
from app.graph.nodes.authenticity import _heuristic_authenticity


def _make_state(**overrides) -> dict:
    base = {
        "analysis_id": "test-id",
        "candidate_id": "cand-1",
        "github_url": "https://github.com/user/repo",
        "resume_text": "Built REST API with JWT and Redis",
        "claims": [],
        "repo_path": "",
        "temp_dir": "",
        "default_branch": "main",
        "repo_metadata": {},
        "ast_data": {},
        "verification_results": [],
        "authenticity_result": {},
        "scores": {},
        "trust_score": 0.0,
        "recommendation": "",
        "risk_level": "MEDIUM",
        "report": {},
        "errors": [],
    }
    base.update(overrides)
    return base


# ── Claim Extraction ──────────────────────────────────────────────────────────

def test_regex_extract_finds_keywords():
    text = "I built a REST API with JWT authentication, Redis caching, and Docker deployment."
    claims = _regex_extract(text)
    assert any("JWT" in c for c in claims)
    assert any("Redis" in c for c in claims)
    assert any("Docker" in c for c in claims)


@pytest.mark.asyncio
async def test_extract_claims_node_fallback():
    """When Gemini is unavailable, node must fall back to regex."""
    with patch("app.graph.nodes.extract_claims.get_llm_service") as mock_svc:
        mock_llm = AsyncMock()
        mock_llm.call_structured = AsyncMock(return_value=None)
        mock_svc.return_value = mock_llm

        state = _make_state(resume_text="Built REST API with JWT, Redis, and Docker.")
        result = await extract_claims_node(state)

    assert isinstance(result["claims"], list)
    assert len(result["claims"]) > 0


# ── Scan Repo ─────────────────────────────────────────────────────────────────

@pytest.fixture
def sample_repo(tmp_path: Path) -> Path:
    (tmp_path / "package.json").write_text(json.dumps({
        "dependencies": {"express": "^4", "jsonwebtoken": "^9", "redis": "^4"},
        "devDependencies": {"jest": "^29"},
    }))
    (tmp_path / "Dockerfile").write_text("FROM node:18\nEXPOSE 3000\n")
    (tmp_path / "docker-compose.yml").write_text("version: '3'\nservices:\n  app:\n    build: .\n")
    (tmp_path / "README.md").write_text("# My Project\n")
    src = tmp_path / "src"
    src.mkdir()
    (src / "auth.js").write_text(
        "const jwt = require('jsonwebtoken');\n"
        "function verifyToken(token) { return jwt.verify(token, process.env.SECRET); }\n"
        "module.exports = { verifyToken };\n"
    )
    (src / "cache.js").write_text(
        "const redis = require('redis');\n"
        "const client = redis.createClient();\n"
    )
    (src / "routes.js").write_text(
        "const express = require('express');\n"
        "const router = express.Router();\n"
        "router.get('/users', (req, res) => res.json([]));\n"
        "router.post('/users', (req, res) => res.json({}));\n"
    )
    tests = tmp_path / "tests"
    tests.mkdir()
    (tests / "auth.test.js").write_text(
        "describe('auth', () => { it('verifies tokens', () => { expect(true).toBe(true); }); });\n"
    )
    return tmp_path


@pytest.mark.asyncio
async def test_scan_repo_node(sample_repo):
    state = _make_state(repo_path=str(sample_repo))
    result = await scan_repo_node(state)

    meta = result["repo_metadata"]
    assert meta["fileCount"] > 0
    assert meta["hasDockerfile"] is True
    assert meta["hasTests"] is True
    assert "JavaScript" in meta["languages"]


@pytest.mark.asyncio
async def test_scan_repo_node_no_path():
    state = _make_state(repo_path="")
    result = await scan_repo_node(state)
    assert result["repo_metadata"] == {}
    assert len(result["errors"]) > 0


# ── AST Analysis ──────────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_ast_analysis_node(sample_repo):
    state = _make_state(repo_path=str(sample_repo))
    result = await ast_analysis_node(state)

    ast = result["ast_data"]
    assert isinstance(ast["functions"], list)
    assert isinstance(ast["routes"], list)
    assert len(ast["routes"]) > 0  # /users routes


@pytest.mark.asyncio
async def test_ast_analysis_node_no_path():
    state = _make_state(repo_path="")
    result = await ast_analysis_node(state)
    assert result["ast_data"] == {}


# ── Authenticity Heuristic ────────────────────────────────────────────────────

def test_heuristic_authenticity_strong():
    repo_meta = {
        "hasTests": True, "hasCi": True,
        "maturityIndicators": [".github/workflows", ".eslintrc", ".prettierrc"],
    }
    ast_data = {
        "functions": [{"name": f"fn{i}"} for i in range(20)],
        "services": ["service1.js", "service2.js"],
        "controllers": ["ctrl.js"],
        "middleware": ["auth.js"],
        "models": ["user.js"],
    }
    result = _heuristic_authenticity(repo_meta, ast_data)
    assert result["authenticityScore"] > 60
    assert result["riskLevel"] in ("LOW", "MEDIUM")


def test_heuristic_authenticity_weak():
    result = _heuristic_authenticity({}, {})
    assert result["authenticityScore"] <= 50
    assert result["riskLevel"] in ("MEDIUM", "HIGH")


# ── Score Node ────────────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_score_node_basic():
    verification_results = [
        {"claim": "JWT", "verified": True, "confidence": 90, "depth": "deep", "evidence": []},
        {"claim": "Redis", "verified": True, "confidence": 80, "depth": "moderate", "evidence": []},
        {"claim": "Kubernetes", "verified": False, "confidence": 0, "depth": "none", "evidence": []},
    ]
    ast_data = {
        "functions": [{"name": f"fn{i}"} for i in range(15)],
        "classes": [{"name": "AuthService"}, {"name": "UserModel"}],
        "routes": [{"route": "/users"}, {"route": "/auth/login"}],
        "services": ["auth.service.js"],
        "controllers": ["user.controller.js"],
        "middleware": ["auth.middleware.js"],
        "models": ["user.model.js"],
        "imports": ["bcrypt", "jsonwebtoken", "dotenv"],
    }
    repo_metadata = {"hasTests": True, "hasDockerfile": True, "hasCi": False, "maturityIndicators": [], "dependencies": {"pip": ["python-dotenv"]}}
    authenticity_result = {"authenticityScore": 75}

    state = _make_state(
        verification_results=verification_results,
        ast_data=ast_data,
        repo_metadata=repo_metadata,
        authenticity_result=authenticity_result,
    )
    result = await score_node(state)

    assert result["trust_score"] > 30
    assert result["trust_score"] <= 100
    assert result["recommendation"] != ""
    assert result["risk_level"] in ("LOW", "MEDIUM", "HIGH")


@pytest.mark.asyncio
async def test_score_node_empty():
    state = _make_state()
    result = await score_node(state)
    assert 0 <= result["trust_score"] <= 100
