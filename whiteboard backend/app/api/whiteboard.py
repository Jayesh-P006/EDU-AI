import json
from uuid import uuid4

from fastapi import APIRouter, HTTPException, Request
from fastapi.responses import Response, StreamingResponse
from pydantic import BaseModel

from app.models.whiteboard import SaveWhiteboardRequest, SolveRequest
from app.services.groq_whiteboard import stream_whiteboard_solution
from app.services import tts_service

router = APIRouter(prefix="/api/whiteboard", tags=["whiteboard"])


def _sse_payload(chunk: dict) -> str:
    return f"data: {json.dumps(chunk, ensure_ascii=False)}\n\n"


@router.post("/solve")
async def solve_whiteboard(payload: SolveRequest, request: Request) -> StreamingResponse:
    question = payload.question.strip()
    if not question:
        raise HTTPException(status_code=400, detail="Question is required")

    async def event_stream():
        try:
            async for chunk in stream_whiteboard_solution(
                question=question,
                subject=payload.subject,
                history=payload.history,
            ):
                if await request.is_disconnected():
                    break

                yield _sse_payload(chunk)

                if chunk.get("type") == "done":
                    break
        except Exception as exc:
            yield _sse_payload({"type": "error", "message": str(exc)})
            yield _sse_payload({"type": "done"})

    return StreamingResponse(
        event_stream(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )


class TTSRequest(BaseModel):
    text: str


@router.post("/tts")
async def text_to_speech(payload: TTSRequest) -> Response:
    """
    Synthesize speech with Coqui TTS and return a WAV audio file.
    Returns 503 if the TTS model is not installed.
    """
    text = payload.text.strip()
    if not text:
        raise HTTPException(status_code=400, detail="text is required")

    audio = await tts_service.synthesize(text)
    if audio is None:
        raise HTTPException(
            status_code=503,
            detail="TTS service unavailable — install TTS: pip install TTS",
        )

    return Response(
        content=audio,
        media_type="audio/wav",
        headers={"Cache-Control": "no-store"},
    )


@router.get("/tts/status")
async def tts_status() -> dict:
    available = tts_service.is_available()
    return {
        "available": available,
        "model": tts_service.TTS_MODEL,
        "status": "ready" if available else ("loading" if available is None else "unavailable"),
    }


@router.post("/save")
async def save_whiteboard_session(payload: SaveWhiteboardRequest) -> dict:
    session_id = payload.session_id or str(uuid4())
    return {
        "success": True,
        "sessionId": session_id,
        "savedElements": len(payload.elements),
        "savedMessages": len(payload.chat_history),
    }
