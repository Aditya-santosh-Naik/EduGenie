"""
EduGenie TTS Service — port 8001.

Returns WAV audio for a block of text.

Engines are tried in preference order and the first one that loads wins:
  1. kokoro  — Kokoro-82M, best quality, ~1.5GB with torch. Optional.
  2. sapi    — the OS speech engine via pyttsx3. Always present on Windows,
               no model download, ~0.5s per request.

Synthesis runs in a subprocess for the SAPI path: the Windows speech API is
COM-based and single-threaded, and driving it from an async worker thread
deadlocks. One short-lived process per request sidesteps that entirely.
"""
from fastapi import FastAPI, HTTPException
from fastapi.responses import Response
from pydantic import BaseModel
import asyncio
import io
import os
import subprocess
import sys
import tempfile

app = FastAPI(title="EduGenie TTS Service", version="1.1.0")

kokoro_pipeline = None
SAPI_AVAILABLE = False


@app.on_event("startup")
async def load_engines():
    global kokoro_pipeline, SAPI_AVAILABLE

    try:
        from kokoro import KPipeline
        kokoro_pipeline = KPipeline(lang_code="a")  # 'a' = American English
        print("[tts] kokoro-82m loaded")
    except Exception as e:
        print(f"[tts] kokoro unavailable ({type(e).__name__}) — optional, skipping")

    try:
        import pyttsx3
        engine = pyttsx3.init()
        voices = engine.getProperty("voices")
        engine.stop()
        SAPI_AVAILABLE = True
        print(f"[tts] sapi ready — {len(voices)} system voice(s)")
    except Exception as e:
        print(f"[tts] sapi unavailable: {e}")

    if not kokoro_pipeline and not SAPI_AVAILABLE:
        print("[tts] no engine available — /tts will return 503")


class TTSRequest(BaseModel):
    text: str
    voice: str = "af_heart"
    speed: float = 1.0


def _engines() -> list[str]:
    out = []
    if kokoro_pipeline is not None:
        out.append("kokoro")
    if SAPI_AVAILABLE:
        out.append("sapi")
    return out


@app.get("/health")
async def health():
    engines = _engines()
    return {
        "status": "ok" if engines else "no_engine",
        "service": "tts",
        "engines": engines,
        "preferred": engines[0] if engines else None,
    }


def _synth_kokoro(text: str, voice: str, speed: float) -> bytes:
    import numpy as np
    import soundfile as sf

    chunks = [audio for _, _, audio in kokoro_pipeline(text, voice=voice, speed=speed)]
    if not chunks:
        raise RuntimeError("kokoro produced no audio")

    buffer = io.BytesIO()
    sf.write(buffer, np.concatenate(chunks), samplerate=24000, format="WAV")
    return buffer.getvalue()


# Runs in its own process — see the module docstring.
_SAPI_WORKER = r"""
import sys, pyttsx3
text_path, out_path, rate_scale = sys.argv[1], sys.argv[2], float(sys.argv[3])
with open(text_path, encoding='utf-8') as fh:
    text = fh.read()
engine = pyttsx3.init()
engine.setProperty('rate', int(engine.getProperty('rate') * rate_scale))
engine.save_to_file(text, out_path)
engine.runAndWait()
engine.stop()
"""


def _synth_sapi(text: str, speed: float) -> bytes:
    tmpdir = tempfile.mkdtemp(prefix="edugenie_tts_")
    text_path = os.path.join(tmpdir, "input.txt")
    wav_path = os.path.join(tmpdir, "out.wav")
    script_path = os.path.join(tmpdir, "worker.py")

    try:
        with open(text_path, "w", encoding="utf-8") as fh:
            fh.write(text)
        with open(script_path, "w", encoding="utf-8") as fh:
            fh.write(_SAPI_WORKER)

        proc = subprocess.run(
            [sys.executable, script_path, text_path, wav_path, str(speed)],
            capture_output=True,
            timeout=120,
        )
        if proc.returncode != 0:
            raise RuntimeError(proc.stderr.decode("utf-8", "replace")[:300] or "sapi worker failed")
        if not os.path.exists(wav_path) or os.path.getsize(wav_path) == 0:
            raise RuntimeError("sapi produced no audio")

        with open(wav_path, "rb") as fh:
            return fh.read()
    finally:
        for path in (text_path, wav_path, script_path):
            try:
                os.unlink(path)
            except OSError:
                pass
        try:
            os.rmdir(tmpdir)
        except OSError:
            pass


@app.post("/tts")
async def text_to_speech(req: TTSRequest):
    if not req.text.strip():
        raise HTTPException(status_code=400, detail="Text is required")

    engines = _engines()
    if not engines:
        raise HTTPException(status_code=503, detail="No TTS engine available")

    # Cap runaway input — a full explanation is a few thousand characters.
    text = req.text.strip()[:5000]
    errors = []

    for engine in engines:
        try:
            if engine == "kokoro":
                audio = await asyncio.to_thread(_synth_kokoro, text, req.voice, req.speed)
            else:
                audio = await asyncio.to_thread(_synth_sapi, text, req.speed)

            return Response(
                content=audio,
                media_type="audio/wav",
                headers={
                    "Content-Disposition": "inline; filename=tts_output.wav",
                    "X-TTS-Engine": engine,
                },
            )
        except Exception as e:
            errors.append(f"{engine}: {e}")
            print(f"[tts] {engine} failed: {e}")

    raise HTTPException(status_code=500, detail=f"All TTS engines failed — {'; '.join(errors)}")


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8001)
