"""
Coqui TTS service — lazy-loads the model on first request.
Model: tts_models/en/jenny/jenny  (natural, low-noise, single-speaker VITS)
Falls back gracefully if the TTS package is not installed.
"""
import asyncio
import logging
import os
import tempfile
from concurrent.futures import ThreadPoolExecutor

logger = logging.getLogger(__name__)

# One background thread so inference never blocks the event loop
_executor = ThreadPoolExecutor(max_workers=1, thread_name_prefix="tts")

_tts       = None
_available = None   # None=unknown, True=ready, False=unavailable
_lock      = asyncio.Lock()

# Change this to any Coqui model name you have downloaded
TTS_MODEL = os.getenv("TTS_MODEL", "tts_models/en/jenny/jenny")


def _load_model():
    """Runs in the thread executor on first call."""
    global _tts, _available
    try:
        from TTS.api import TTS  # noqa: PLC0415
        logger.info("[TTS] Loading model %s …", TTS_MODEL)
        _tts = TTS(model_name=TTS_MODEL, progress_bar=False, gpu=False)
        _available = True
        logger.info("[TTS] Model ready.")
    except Exception as exc:
        logger.warning("[TTS] Coqui TTS unavailable (%s). Falling back to browser TTS.", exc)
        _available = False


def _run_synthesis(text: str) -> bytes | None:
    """Synthesize text → WAV bytes. Runs in executor thread."""
    if not _available or _tts is None:
        return None
    tmp = tempfile.NamedTemporaryFile(suffix=".wav", delete=False)
    path = tmp.name
    tmp.close()
    try:
        _tts.tts_to_file(text=text, file_path=path)
        with open(path, "rb") as f:
            return f.read()
    except Exception as exc:
        logger.error("[TTS] Synthesis error: %s", exc)
        return None
    finally:
        try:
            os.unlink(path)
        except OSError:
            pass


async def ensure_ready() -> bool:
    """Lazy-initialise the model exactly once. Returns True if TTS is available."""
    global _available
    if _available is not None:
        return _available
    async with _lock:
        if _available is not None:
            return _available
        loop = asyncio.get_event_loop()
        await loop.run_in_executor(_executor, _load_model)
    return _available or False


async def synthesize(text: str) -> bytes | None:
    """
    Public API: synthesize text and return WAV bytes, or None if TTS unavailable.
    Safe to call from async handlers.
    """
    ready = await ensure_ready()
    if not ready:
        return None
    clean = text.strip()
    if not clean:
        return None
    loop = asyncio.get_event_loop()
    return await loop.run_in_executor(_executor, _run_synthesis, clean)


def is_available() -> bool | None:
    return _available
