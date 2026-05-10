"""
EduGenie STT Service — faster-whisper base
Runs on port 8002. Transcribes audio to text.
Uses CPU to save VRAM for LLM/ComfyUI.
"""
from fastapi import FastAPI, UploadFile, File, HTTPException
from pydantic import BaseModel
import tempfile
import os

app = FastAPI(title="EduGenie STT Service", version="1.0.0")

# Global model reference
whisper_model = None


@app.on_event("startup")
async def load_model():
    global whisper_model
    try:
        from faster_whisper import WhisperModel
        # Use CPU to preserve GPU VRAM for LLM and ComfyUI
        whisper_model = WhisperModel("base", device="cpu", compute_type="int8")
        print("[stt] faster-whisper base model loaded (CPU mode)")
    except Exception as e:
        print(f"[stt] Failed to load whisper model: {e}")


@app.get("/health")
async def health():
    return {
        "status": "ok" if whisper_model is not None else "model_not_loaded",
        "model": "faster-whisper-base",
        "device": "cpu",
        "service": "stt"
    }


@app.post("/transcribe")
async def transcribe(audio: UploadFile = File(...)):
    if whisper_model is None:
        raise HTTPException(status_code=503, detail="STT model not loaded")

    # Write uploaded audio to a temp file
    suffix = os.path.splitext(audio.filename or "audio.wav")[1] or ".wav"
    with tempfile.NamedTemporaryFile(suffix=suffix, delete=False) as tmp:
        content = await audio.read()
        tmp.write(content)
        tmp_path = tmp.name

    try:
        # Transcribe using faster-whisper
        segments, info = whisper_model.transcribe(
            tmp_path,
            beam_size=5,
            language="en",
            vad_filter=True
        )

        # Collect all segment texts
        transcript = " ".join(segment.text.strip() for segment in segments)

        return {
            "transcript": transcript,
            "language": info.language,
            "language_probability": round(info.language_probability, 2),
            "duration": round(info.duration, 2)
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Transcription failed: {str(e)}")
    finally:
        # Clean up temp file
        try:
            os.unlink(tmp_path)
        except OSError:
            pass


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8002)
