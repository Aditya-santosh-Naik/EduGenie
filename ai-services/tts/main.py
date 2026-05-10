"""
EduGenie TTS Service — Kokoro-82M
Runs on port 8001. Generates WAV audio from text.
"""
from fastapi import FastAPI, HTTPException
from fastapi.responses import Response
from pydantic import BaseModel
import io
import numpy as np
import soundfile as sf

app = FastAPI(title="EduGenie TTS Service", version="1.0.0")

# Global model reference — loaded once on startup
kokoro_pipeline = None


@app.on_event("startup")
async def load_model():
    global kokoro_pipeline
    try:
        from kokoro import KPipeline
        kokoro_pipeline = KPipeline(lang_code="a")  # 'a' = American English
        print("[tts] Kokoro-82M model loaded successfully")
    except Exception as e:
        print(f"[tts] Failed to load Kokoro model: {e}")
        print("[tts] Service will return 503 until model is available")


class TTSRequest(BaseModel):
    text: str
    voice: str = "af_heart"
    speed: float = 1.0


@app.get("/health")
async def health():
    return {
        "status": "ok" if kokoro_pipeline is not None else "model_not_loaded",
        "model": "kokoro-82m",
        "service": "tts"
    }


@app.post("/tts")
async def text_to_speech(req: TTSRequest):
    if kokoro_pipeline is None:
        raise HTTPException(status_code=503, detail="TTS model not loaded")

    if not req.text.strip():
        raise HTTPException(status_code=400, detail="Text is required")

    try:
        # Generate audio using Kokoro pipeline
        # Kokoro returns a generator of (graphemes, phonemes, audio_chunk) tuples
        audio_chunks = []
        for _, _, audio_chunk in kokoro_pipeline(
            req.text,
            voice=req.voice,
            speed=req.speed
        ):
            audio_chunks.append(audio_chunk)

        if not audio_chunks:
            raise HTTPException(status_code=500, detail="No audio generated")

        # Concatenate all audio chunks
        full_audio = np.concatenate(audio_chunks)

        # Write to WAV buffer
        buffer = io.BytesIO()
        sf.write(buffer, full_audio, samplerate=24000, format="WAV")
        buffer.seek(0)

        return Response(
            content=buffer.read(),
            media_type="audio/wav",
            headers={"Content-Disposition": "inline; filename=tts_output.wav"}
        )

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"TTS generation failed: {str(e)}")


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8001)
