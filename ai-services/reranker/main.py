"""
EduGenie Reranker — BAAI/bge-reranker-v2-m3
Runs on port 8005. Reranks RAG chunks by relevance to query.
Uses CPU to preserve VRAM.
"""
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from typing import List
import torch

app = FastAPI(title="EduGenie Reranker", version="1.0.0")

# Global model reference
reranker_model = None


@app.on_event("startup")
async def load_model():
    global reranker_model
    try:
        from sentence_transformers import CrossEncoder
        # Load on CPU to preserve GPU VRAM for LLM/ComfyUI
        reranker_model = CrossEncoder(
            "BAAI/bge-reranker-v2-m3",
            max_length=512,
            device="cpu"
        )
        print("[reranker] bge-reranker-v2-m3 loaded (CPU mode)")
    except Exception as e:
        print(f"[reranker] Failed to load model: {e}")


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
        "model": "BAAI/bge-reranker-v2-m3",
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
