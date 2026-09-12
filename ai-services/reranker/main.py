"""
EduGenie Reranker — port 8005.

Second stage of retrieval: the vector search returns chunks scored by a
bi-encoder, which embeds query and chunk separately and never compares them
directly. A cross-encoder reads the pair together and scores relevance far more
accurately — too slowly for a whole corpus, which is why it only ever sees the
handful of candidates vector search already shortlisted.

Runs on CPU on purpose: the GPU is reserved for the LLM and diffusion models.

RERANKER_MODEL picks the cross-encoder:
  cross-encoder/ms-marco-MiniLM-L-6-v2   default, ~90MB, tens of ms per pair
  BAAI/bge-reranker-v2-m3                ~2.2GB, multilingual, markedly slower
"""
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from typing import List
import os
import torch

app = FastAPI(title="EduGenie Reranker", version="1.0.0")

# Global model reference
reranker_model = None


MODEL_NAME = os.getenv("RERANKER_MODEL", "cross-encoder/ms-marco-MiniLM-L-6-v2")


@app.on_event("startup")
async def load_model():
    global reranker_model
    try:
        from sentence_transformers import CrossEncoder
        # CPU on purpose — the GPU belongs to the LLM and ComfyUI.
        reranker_model = CrossEncoder(MODEL_NAME, max_length=512, device="cpu")
        print(f"[reranker] {MODEL_NAME} loaded (CPU mode)")
    except Exception as e:
        print(f"[reranker] failed to load {MODEL_NAME}: {e}")


class RerankRequest(BaseModel):
    query: str
    chunks: List[str]
    top_k: int = 3


class RerankResult(BaseModel):
    text: str
    score: float
    original_index: int


@app.get("/health")
async def health():
    return {
        "status": "ok" if reranker_model is not None else "model_not_loaded",
        "model": MODEL_NAME,
        "device": "cpu",
        "service": "reranker"
    }


@app.post("/rerank")
async def rerank(req: RerankRequest):
    if reranker_model is None:
        raise HTTPException(status_code=503, detail="Reranker model not loaded")

    if not req.query.strip():
        raise HTTPException(status_code=400, detail="Query is required")

    if not req.chunks:
        return {"results": []}

    try:
        # Create query-chunk pairs for cross-encoder scoring
        pairs = [[req.query, chunk] for chunk in req.chunks]

        # Score all pairs
        with torch.no_grad():
            scores = reranker_model.predict(pairs)

        # Combine chunks with scores and sort by relevance
        scored_chunks = [
            {"text": chunk, "score": float(score), "original_index": i}
            for i, (chunk, score) in enumerate(zip(req.chunks, scores))
        ]
        scored_chunks.sort(key=lambda x: x["score"], reverse=True)

        # Return top_k results
        top_results = scored_chunks[: req.top_k]

        return {"results": top_results, "total_scored": len(req.chunks)}

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Reranking failed: {str(e)}")


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8005)
