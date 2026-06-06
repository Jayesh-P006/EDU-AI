"""Tests for service-layer components."""

import json
from pathlib import Path
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from app.services.repository_scanner import RepositoryScanner
from app.services.ast_parser import ASTParser
from app.services.scoring_engine import ScoringEngine
from app.services.github_zip_service import url_to_zip, extract_owner_repo
from app.graph.nodes.verify_claims import ClaimVerifier


# ── GitHub URL utilities ──────────────────────────────────────────────────────

def test_url_to_zip_main():
    assert url_to_zip("https://github.com/alice/backend", "main") == \
        "https://github.com/alice/backend/archive/refs/heads/main.zip"


def test_url_to_zip_trailing_slash():
    assert url_to_zip("https://github.com/alice/backend/", "master") == \
        "https://github.com/alice/backend/archive/refs/heads/master.zip"


def test_extract_owner_repo():
    owner, repo = extract_owner_repo("https://github.com/alice/my-api")
    assert owner == "alice"
    assert repo == "my-api"


# ── Repository Scanner ────────────────────────────────────────────────────────

@pytest.fixture
def sample_repo(tmp_path: Path) -> Path:
    (tmp_path / "package.json").write_text(json.dumps({
        "dependencies": {
            "express": "^4", "jsonwebtoken": "^9", "redis": "^4", "socket.io": "^4"
        },
        "devDependencies": {"jest": "^29", "typescript": "^5"},
    }))
    (tmp_path / "Dockerfile").write_text("FROM node:20-alpine\nEXPOSE 3000\n")
    (tmp_path / "README.md").write_text("# Project\n")
    src = tmp_path / "src"
    src.mkdir()
    (src / "app.ts").write_text(
        "import express from 'express';\nconst app = express();\n"
        "app.get('/health', (req, res) => res.json({ ok: true }));\n"
    )
    (src / "auth.service.ts").write_text(
        "import * as jwt from 'jsonwebtoken';\n"
        "export class AuthService {\n"
        "  sign(payload: any) { return jwt.sign(payload, process.env.SECRET!); }\n"
        "}\n"
    )
    tests = tmp_path / "__tests__"
    tests.mkdir()
    (tests / "auth.spec.ts").write_text(
        "describe('AuthService', () => { it('signs tokens', () => {}); });\n"
    )
    (tmp_path / ".github").mkdir()
    workflows = tmp_path / ".github" / "workflows"
    workflows.mkdir()
    (workflows / "ci.yml").write_text("on:\n  push:\n    branches: [main]\njobs:\n  build:\n    runs-on: ubuntu-latest\n")
    return tmp_path


def test_scanner_basic(sample_repo):
    scanner = RepositoryScanner(sample_repo)
    result = scanner.scan()

    assert result["fileCount"] > 0
    assert result["hasDockerfile"] is True
    assert result["hasReadme"] is True
    assert result["hasTests"] is True
    assert result["hasCi"] is True
    assert "TypeScript" in result["languages"]
    assert "npm" in result["dependencies"]
    assert "jsonwebtoken" in result["dependencies"]["npm"]


def test_scanner_frameworks(sample_repo):
    scanner = RepositoryScanner(sample_repo)
    result = scanner.scan()
    frameworks = result["frameworks"]
    assert "Express.js" in frameworks
    assert "Socket.IO" in frameworks


def test_scanner_empty_dir(tmp_path):
    scanner = RepositoryScanner(tmp_path)
    result = scanner.scan()
    assert result["fileCount"] == 0
    assert result["languages"] == {}


# ── AST Parser ────────────────────────────────────────────────────────────────

def test_ast_js_routes(sample_repo):
    parser = ASTParser(sample_repo)
    result = parser.parse_repository()
    assert any(r["route"] == "/health" for r in result["routes"])


def test_ast_ts_service(sample_repo):
    parser = ASTParser(sample_repo)
    result = parser.parse_repository()
    assert len(result["services"]) > 0


def test_ast_empty(tmp_path):
    parser = ASTParser(tmp_path)
    result = parser.parse_repository()
    assert result["functions"] == []


def test_ast_python(tmp_path):
    py_file = tmp_path / "main.py"
    py_file.write_text(
        "import redis\n"
        "from fastapi import FastAPI\n\n"
        "app = FastAPI()\n\n"
        "def get_user(user_id: int):\n"
        "    return {'id': user_id}\n\n"
        "@app.get('/users')\n"
        "async def list_users():\n"
        "    return []\n"
    )
    parser = ASTParser(tmp_path)
    result = parser.parse_repository()
    assert any("get_user" in fn["name"] or "list_users" in fn["name"] for fn in result["functions"])
    assert any("/users" in r["route"] for r in result["routes"])


# ── Feature Verifier ──────────────────────────────────────────────────────────

def test_verifier_finds_jwt_evidence(sample_repo):
    scan = RepositoryScanner(sample_repo).scan()
    ast = ASTParser(sample_repo).parse_repository()
    verifier = ClaimVerifier(sample_repo, ast, scan)

    evidence = verifier.find_evidence("JWT Authentication")
    assert len(evidence) > 0
    # Should point to auth.service.ts
    files = [e["file"] for e in evidence]
    assert any("auth" in f.lower() for f in files)


def test_verifier_finds_no_evidence_for_unknown(sample_repo):
    scan = RepositoryScanner(sample_repo).scan()
    ast = ASTParser(sample_repo).parse_repository()
    verifier = ClaimVerifier(sample_repo, ast, scan)

    evidence = verifier.find_evidence("Kubernetes")
    # Kubernetes not in this repo — should return empty or minimal
    assert len(evidence) == 0 or all("kubernetes" not in e["file"].lower() for e in evidence)


# ── Scoring Engine ────────────────────────────────────────────────────────────

def test_scoring_strong_profile():
    claim_results = [
        {"claim": "JWT", "verified": True, "confidence": 95, "depth": "deep", "evidence": []},
        {"claim": "Redis", "verified": True, "confidence": 85, "depth": "deep", "evidence": []},
        {"claim": "Docker", "verified": True, "confidence": 90, "depth": "moderate", "evidence": []},
    ]
    ast_data = {
        "functions": [{"name": f"fn{i}"} for i in range(25)],
        "classes": [{"name": "Svc"}, {"name": "Ctrl"}, {"name": "Model"}],
        "routes": [{"route": f"/r{i}"} for i in range(8)],
        "services": ["s1.js", "s2.js"],
        "controllers": ["c1.js"],
        "middleware": ["auth.js"],
        "models": ["user.js"],
        "imports": ["bcrypt", "jwt", "dotenv"],
    }
    repo = {
        "hasTests": True, "hasDockerfile": True, "hasCi": True,
        "maturityIndicators": ["tsconfig.json", ".eslintrc", ".github/workflows"],
        "dependencies": {"npm": ["bcrypt", "dotenv"]},
    }
    auth = {"authenticityScore": 82}

    engine = ScoringEngine()
    breakdown = engine.compute(claim_results, ast_data, repo, auth)

    assert breakdown.trust_score > 70
    assert breakdown.risk_level == "LOW"
    assert "Technical Interview" in breakdown.recommendation


def test_scoring_empty_profile():
    engine = ScoringEngine()
    breakdown = engine.compute([], {}, {}, {"authenticityScore": 20})
    assert 0 <= breakdown.trust_score <= 100
    assert breakdown.risk_level == "HIGH"


def test_scoring_mixed_claims():
    claim_results = [
        {"claim": "JWT", "verified": True, "confidence": 70, "depth": "shallow", "evidence": []},
        {"claim": "Kubernetes", "verified": False, "confidence": 0, "depth": "none", "evidence": []},
    ]
    engine = ScoringEngine()
    breakdown = engine.compute(claim_results, {}, {}, {"authenticityScore": 50})
    assert 0 <= breakdown.trust_score <= 100
