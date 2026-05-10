"""
EduGenie PDF Parser — IBM Docling
Runs on port 8004. Converts PDF files to structured markdown.
"""
from fastapi import FastAPI, UploadFile, File, HTTPException
import tempfile
import os

app = FastAPI(title="EduGenie PDF Parser", version="1.0.0")


@app.get("/health")
async def health():
    try:
        from docling.document_converter import DocumentConverter
        return {"status": "ok", "library": "docling", "service": "pdf-parser"}
    except ImportError:
        return {"status": "docling_not_installed", "service": "pdf-parser"}


@app.post("/parse")
async def parse_pdf(file: UploadFile = File(...)):
    if not file.filename or not file.filename.lower().endswith(".pdf"):
        raise HTTPException(status_code=400, detail="Only PDF files are supported")

    # Write to temp file
    with tempfile.NamedTemporaryFile(suffix=".pdf", delete=False) as tmp:
        content = await file.read()
        tmp.write(content)
        tmp_path = tmp.name

    try:
        from docling.document_converter import DocumentConverter

        # Convert PDF to structured document
        converter = DocumentConverter()
        result = converter.convert(tmp_path)

        # Export as markdown
        markdown = result.document.export_to_markdown()

        # Get basic metadata
        page_count = len(result.document.pages) if hasattr(result.document, 'pages') else 0

        return {
            "markdown": markdown,
            "pages": page_count,
            "filename": file.filename,
            "size_bytes": len(content),
            "metadata": {
                "title": getattr(result.document, 'title', None),
            }
        }

    except ImportError:
        raise HTTPException(
            status_code=503,
            detail="Docling is not installed. Run: pip install docling"
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"PDF parsing failed: {str(e)}")
    finally:
        try:
            os.unlink(tmp_path)
        except OSError:
            pass


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8004)
