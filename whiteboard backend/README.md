# EDU-AI Whiteboard FastAPI Backend

FastAPI backend for the AI Doubt Solver with Live Whiteboard. It exposes the same contract as the original Express spec:

- `POST /api/whiteboard/solve`: streams Server-Sent Events with JSON chunks.
- `POST /api/whiteboard/save`: returns a generated session ID placeholder for persistence.
- `GET /health`: health check.

## Run locally

```powershell
cd backend
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
Copy-Item .env.example .env
uvicorn app.main:app --reload --port 5000
```

Set `GROQ_API_KEY` in `.env` before using real Groq output. The backend calls Groq through its OpenAI-compatible Chat Completions streaming endpoint. Until the key is configured, `ALLOW_DEMO_FALLBACK=true` streams deterministic demo chunks so the frontend can be built and tested.

## Streaming request

```http
POST /api/whiteboard/solve
Content-Type: application/json

{
  "question": "Explain recursion with a tree example",
  "subject": "CS",
  "history": []
}
```

The response uses SSE framing:

```text
data: {"type":"text","content":"Let's start with the simplest case."}

data: {"type":"draw","command":"node","data":{"id":"base","label":"Base Case","x":480,"y":80}}

data: {"type":"done"}
```

Your existing frontend can keep using `fetch('/api/whiteboard/solve', { method: 'POST', ... })` and parse `data: ...` lines from `response.body.getReader()`.
