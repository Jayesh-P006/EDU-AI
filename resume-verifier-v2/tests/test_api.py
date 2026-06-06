import pytest
from unittest.mock import patch, MagicMock, AsyncMock


HEADERS = {"X-API-Key": "change-me-in-production"}
VALID_PAYLOAD = {
    "candidateId": "cand-001",
    "githubUrl": "https://github.com/user/my-project",
    "resumeText": "Built a REST API with JWT authentication, Redis caching and Docker deployment.",
}


@pytest.mark.asyncio
async def test_health_ok(client):
    with (
        patch("app.api.health.aioredis.from_url") as mock_redis,
        patch("app.api.health.get_llm_service") as mock_llm_svc,
    ):
        mock_r = AsyncMock()
        mock_r.ping = AsyncMock(return_value=True)
        mock_r.aclose = AsyncMock()
        mock_redis.return_value = mock_r

        mock_llm = AsyncMock()
        mock_llm.check_connectivity = AsyncMock(return_value=True)
        mock_llm_svc.return_value = mock_llm

        resp = await client.get("/health")

    assert resp.status_code == 200
    body = resp.json()
    assert body["service"] == "resume-verifier-v2"
    assert "status" in body
    assert "database" in body


@pytest.mark.asyncio
async def test_analyze_requires_api_key(client):
    resp = await client.post("/api/v1/analyze", json=VALID_PAYLOAD)
    assert resp.status_code == 403


@pytest.mark.asyncio
async def test_analyze_rejects_non_github_url(client):
    bad_payload = {**VALID_PAYLOAD, "githubUrl": "https://gitlab.com/user/repo"}
    resp = await client.post("/api/v1/analyze", json=bad_payload, headers=HEADERS)
    assert resp.status_code == 422


@pytest.mark.asyncio
async def test_analyze_rejects_short_resume(client):
    short_payload = {**VALID_PAYLOAD, "resumeText": "short"}
    resp = await client.post("/api/v1/analyze", json=short_payload, headers=HEADERS)
    assert resp.status_code == 422


@pytest.mark.asyncio
async def test_analyze_queues_job(client):
    with patch("app.api.analyze.run_analysis") as mock_task:
        mock_result = MagicMock()
        mock_result.id = "celery-task-abc-123"
        mock_task.apply_async.return_value = mock_result

        resp = await client.post("/api/v1/analyze", json=VALID_PAYLOAD, headers=HEADERS)

    assert resp.status_code == 202
    body = resp.json()
    assert "analysisId" in body
    assert body["status"] == "queued"


@pytest.mark.asyncio
async def test_get_status_not_found(client):
    resp = await client.get(
        "/api/v1/analyze/00000000-0000-0000-0000-000000000000",
        headers=HEADERS,
    )
    assert resp.status_code == 404


@pytest.mark.asyncio
async def test_get_status_invalid_uuid(client):
    resp = await client.get("/api/v1/analyze/not-a-uuid", headers=HEADERS)
    assert resp.status_code == 400


@pytest.mark.asyncio
async def test_get_report_not_found(client):
    resp = await client.get(
        "/api/v1/report/00000000-0000-0000-0000-000000000000",
        headers=HEADERS,
    )
    assert resp.status_code == 404


@pytest.mark.asyncio
async def test_analyze_full_cycle(client):
    """Submit → poll status → report (mocked worker)."""
    with patch("app.api.analyze.run_analysis") as mock_task:
        mock_result = MagicMock()
        mock_result.id = "celery-abc"
        mock_task.apply_async.return_value = mock_result

        submit = await client.post("/api/v1/analyze", json=VALID_PAYLOAD, headers=HEADERS)
    assert submit.status_code == 202
    analysis_id = submit.json()["analysisId"]

    # Status should be queued (worker is mocked)
    status_resp = await client.get(f"/api/v1/analyze/{analysis_id}", headers=HEADERS)
    assert status_resp.status_code == 200
    assert status_resp.json()["status"] == "queued"

    # Report not yet available
    report_resp = await client.get(f"/api/v1/report/{analysis_id}", headers=HEADERS)
    assert report_resp.status_code == 202
