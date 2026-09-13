"""
EduGenie PDF Parser — port 8004.

Converts PDFs to structured markdown for RAG ingestion.

Two engines, tried in order:
  1. docling  — IBM's layout model. Best structure (real tables, reading order),
                but a ~2GB install that downloads models on first run.
  2. pymupdf  — always installed. Fast, pure text + heuristic headings.

docling is optional on purpose: the service must work on a fresh clone with a
small install, and upgrade cleanly when the heavy dependency is present.
"""
from fastapi import FastAPI, UploadFile, File, HTTPException
import os
import re
import tempfile

app = FastAPI(title="EduGenie PDF Parser", version="1.1.0")


def _docling_available() -> bool:
    try:
        import docling.document_converter  # noqa: F401
        return True
    except Exception:
        return False


def _parse_with_docling(path: str):
    from docling.document_converter import DocumentConverter

    result = DocumentConverter().convert(path)
    markdown = result.document.export_to_markdown()
    pages = len(result.document.pages) if hasattr(result.document, "pages") else 0
    return markdown, pages


def _looks_like_heading(line: str, body_size: float, size: float) -> bool:
    """A short line noticeably larger than body text, or an ALL-CAPS/numbered line."""
    stripped = line.strip()
    if not stripped or len(stripped) > 90:
        return False
    if size >= body_size * 1.15:
        return True
    if stripped.isupper() and len(stripped.split()) <= 10:
        return True
    return bool(re.match(r"^\d+(\.\d+)*\.?\s+[A-Z]", stripped))


def _parse_with_pymupdf(path: str):
    """Rebuild markdown from PyMuPDF's span data, promoting larger spans to headings."""
    import fitz  # PyMuPDF

    doc = fitz.open(path)

    # Body size = the most common span size across the document.
    sizes: dict[float, int] = {}
    for page in doc:
        for block in page.get_text("dict")["blocks"]:
            for line in block.get("lines", []):
                for span in line.get("spans", []):
                    if span["text"].strip():
                        key = round(span["size"], 1)
                        sizes[key] = sizes.get(key, 0) + len(span["text"])
    body_size = max(sizes, key=sizes.get) if sizes else 12.0

    out: list[str] = []
    for page in doc:
        for block in page.get_text("dict")["blocks"]:
            for line in block.get("lines", []):
                spans = line.get("spans", [])
                text = "".join(s["text"] for s in spans).strip()
                if not text:
                    continue
                size = max((s["size"] for s in spans), default=body_size)
                if _looks_like_heading(text, body_size, size):
                    level = "##" if size >= body_size * 1.3 else "###"
                    out.append(f"\n{level} {text}\n")
                else:
                    out.append(text)

    pages = doc.page_count
    doc.close()

    # Join, then collapse the line-per-span output back into paragraphs.
    markdown = "\n".join(out)
    markdown = re.sub(r"\n{3,}", "\n\n", markdown)
    return markdown.strip(), pages


@app.get("/health")
async def health():
    engines = ["pymupdf"]
    if _docling_available():
        engines.insert(0, "docling")
    return {
        "status": "ok",
        "service": "pdf-parser",
        "engines": engines,
        "preferred": engines[0],
    }


@app.post("/parse")
async def parse_pdf(file: UploadFile = File(...)):
    if not file.filename or not file.filename.lower().endswith(".pdf"):
        raise HTTPException(status_code=400, detail="Only PDF files are supported")

    content = await file.read()
    if not content:
        raise HTTPException(status_code=400, detail="Empty file")

    with tempfile.NamedTemporaryFile(suffix=".pdf", delete=False) as tmp:
        tmp.write(content)
        tmp_path = tmp.name

    try:
        markdown, pages, engine = "", 0, ""

        if _docling_available():
            try:
                markdown, pages = _parse_with_docling(tmp_path)
                engine = "docling"
            except Exception as e:
                print(f"[pdf] docling failed ({e}) — falling back to pymupdf")

        if not markdown.strip():
            markdown, pages = _parse_with_pymupdf(tmp_path)
            engine = "pymupdf"

        if not markdown.strip():
            raise HTTPException(
                status_code=422,
                detail="No extractable text — this looks like a scanned PDF, which needs OCR",
            )

        return {
            "markdown": markdown,
            "pages": pages,
            "engine": engine,
            "filename": file.filename,
            "size_bytes": len(content),
            "chars": len(markdown),
        }

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"PDF parsing failed: {e}")
    finally:
        try:
            os.unlink(tmp_path)
        except OSError:
            pass


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8004)
