# Resume Verification Microservice v2

A production-grade, recruiter-focused GitHub repository verification engine.

**Stack:** FastAPI · LangGraph · LangChain · Gemini 2.5 Pro/Flash · PostgreSQL · Redis · Celery · Tree-sitter

---

## Architecture

```
Node.js Backend  →  POST /api/v1/analyze  →  FastAPI  →  Celery Queue
                                                               │
                                               ┌──────────────▼──────────────┐
                                               │      LangGraph Workflow      │
                                               │                              │
                                               │  [1] Extract Claims (Flash)  │
                                               │  [2] Download Repo ZIP       │
                                               │  [3] Repository Scan         │
                                               │  [4] AST Analysis            │
                                               │  [5] Feature Verification    │
                                               │      (code search + Flash)   │
                                               │  [6] Authenticity Analysis   │
                                               │      (Gemini Pro)            │
                                               │  [7] Trust Score Engine      │
                                               │  [8] Report Generation       │
                                               └──────────────┬──────────────┘
                                                              │
                                                         PostgreSQL
```

---

## Trust Score Weights

| Component             | Weight |
|-----------------------|--------|
| Feature Verification  | 35%    |
| Architecture Quality  | 20%    |
| Code Quality          | 15%    |
| Security Quality      | 15%    |
| Authenticity          | 15%    |

---

## Prerequisites

- Python 3.12+
- PostgreSQL 15+ running locally
- Redis 7+ running locally
- Gemini API key (from [aistudio.google.com](https://aistudio.google.com))

---

## Setup

### 1. Create the database

```sql
-- Connect to PostgreSQL as superuser
CREATE DATABASE resume_verifier_v2;
```

### 2. Install dependencies

```bash
cd resume-verifier-v2
python -m venv .venv

# Windows
.venv\Scripts\activate

# macOS / Linux
source .venv/bin/activate

pip install -r requirements.txt
```

### 3. Configure environment

```bash
cp .env.example .env
# Edit .env and fill in:
#   GEMINI_API_KEY
#   API_KEY          (shared secret used by your Node.js backend)
#   DATABASE_URL     (update password if needed)
```

### 4. Run database migrations

```bash
alembic upgrade head
```

---

## Running the service

Open **three separate terminals** in the project root:

### Terminal 1 — Redis

```bash
redis-server
```

### Terminal 2 — FastAPI

```bash
uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```

Set `DEBUG=true` in `.env` to enable Swagger UI at `http://localhost:8000/docs`.

### Terminal 3 — Celery Worker

```bash
celery -A app.core.celery_app worker --loglevel=info --concurrency=4
```

Optional — Celery task monitor:

```bash
celery -A app.core.celery_app flower --port=5555
```

---

## API Reference

### POST /api/v1/analyze

Submit a candidate for verification.

**Header:** `X-API-Key: <your-api-key>`

```json
{
  "candidateId": "candidate-123",
  "githubUrl": "https://github.com/user/project",
  "resumeText": "Built AI chatbot with JWT auth, Redis caching, LangChain and Docker."
}
```

**Response (202):**
```json
{
  "analysisId": "550e8400-e29b-...",
  "status": "queued",
  "message": "Analysis queued successfully."
}
```

---

### GET /api/v1/analyze/{analysisId}

Poll for status.

**Response (200):**
```json
{
  "analysisId": "550e8400-...",
  "candidateId": "candidate-123",
  "status": "completed",
  "trustScore": 84.5,
  "recommendation": "Proceed to Technical Interview",
  "riskLevel": "LOW"
}
```

---

### GET /api/v1/report/{analysisId}

Full verification report (only available when `status == "completed"`).

**Response (200):**
```json
{
  "analysisId": "550e8400-...",
  "candidateId": "candidate-123",
  "repositorySummary": {
    "githubUrl": "https://github.com/user/project",
    "fileCount": 142,
    "languages": {"TypeScript": {"files": 89, "percentage": 62.7}},
    "frameworks": ["Express.js", "Socket.IO", "Redis"],
    "hasTests": true,
    "hasCi": true
  },
  "verifiedClaims": [
    {
      "claim": "JWT Authentication",
      "verified": true,
      "confidence": 97,
      "depth": "deep",
      "reasoning": "Full JWT implementation found: signing, verification, refresh tokens, and auth middleware.",
      "evidence": [
        {"file": "src/auth/auth.service.ts", "line": 24, "reason": "Pattern 'jwt.sign(' found"}
      ]
    }
  ],
  "missingClaims": ["Kubernetes"],
  "trustScore": 84.5,
  "qualityScore": 78.0,
  "authenticityScore": 82.0,
  "architectureScore": 90.0,
  "securityScore": 75.0,
  "recommendation": "Proceed to Technical Interview",
  "riskLevel": "LOW",
  "authenticityReasoning": [
    "Deep layered architecture: controllers, services, and models are clearly separated",
    "Comprehensive test coverage with Jest",
    "CI/CD pipeline configured with GitHub Actions"
  ]
}
```

---

### GET /health

```json
{
  "status": "ok",
  "service": "resume-verifier-v2",
  "database": "ok",
  "redis": "ok",
  "gemini": "ok"
}
```

---

## Testing

```bash
pytest
```

Run without LLM calls (all LLM services are mocked in tests):

```bash
pytest -x -q
```

---

## LangGraph Workflow Nodes

| Node | Model | Purpose |
|------|-------|---------|
| `extract_claims` | Gemini Flash | Parse resume → structured claim list |
| `download_repo` | — | Download + extract GitHub ZIP |
| `scan_repo` | — | Detect languages, frameworks, deps |
| `ast_analysis` | Tree-sitter | Extract code structure metadata |
| `verify_claims` | Gemini Flash | Evidence search + LLM reasoning per claim |
| `authenticity` | **Gemini Pro** | Deep architectural authenticity analysis |
| `score` | — | Weighted trust score computation |
| `generate_report` | — | Assemble final structured report |

---

## Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `DATABASE_URL` | Async PostgreSQL URL | Yes |
| `SYNC_DATABASE_URL` | Sync PostgreSQL URL (Celery) | Yes |
| `REDIS_URL` | Redis connection URL | Yes |
| `CELERY_BROKER_URL` | Celery broker | Yes |
| `CELERY_RESULT_BACKEND` | Celery result backend | Yes |
| `GEMINI_API_KEY` | Google Gemini API key | Yes |
| `GEMINI_PRO_MODEL` | Pro model ID | `gemini-2.5-pro` |
| `GEMINI_FLASH_MODEL` | Flash model ID | `gemini-2.5-flash` |
| `API_KEY` | Shared API key with Node.js backend | Yes |
| `MAX_REPO_SIZE_MB` | Max ZIP size to download | `500` |
| `DEBUG` | Enable debug logging + Swagger UI | `false` |
