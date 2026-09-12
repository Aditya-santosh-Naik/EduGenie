import { Hono } from 'hono';
import { parsePDF } from '../services/pdfParser.js';
import { ingestDocument, retrieveChunks, documentStats, clearDocuments } from '../services/rag.js';

const rag = new Hono();

rag.post('/upload', async (c) => {
  const userId = c.get('uid');

  let file: File | null = null;
  try {
    const formData = await c.req.formData();
    file = formData.get('file') as File | null;
  } catch {
    return c.json({ error: 'Expected a multipart form with a "file" field' }, 400);
  }

  if (!file || typeof file.arrayBuffer !== 'function') {
    return c.json({ error: 'No file uploaded' }, 400);
  }
  if (file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf')) {
    return c.json({ error: 'Only PDF files are supported' }, 400);
  }

  const buffer = Buffer.from(await file.arrayBuffer());

  const parsed = await parsePDF(buffer);
  if (!parsed) {
    return c.json(
      {
        error: `Could not read that PDF. The parser service on ${process.env.PDF_SERVICE_URL} did not respond — start it with: ai-services/pdf-parser/venv/Scripts/python.exe main.py`
      },
      503
    );
  }

  try {
    const { chunkCount, backend } = await ingestDocument(parsed.markdown, {
      source: file.name,
      userId
    });

    return c.json({
      success: true,
      chunkCount,
      pages: parsed.pages,
      engine: parsed.engine,
      backend,
      message: `Indexed ${chunkCount} chunks from ${file.name}`
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Ingestion failed';
    console.error('[rag] ingest failed:', message);
    return c.json({ error: message }, 500);
  }
});

/** Retrieval on its own — shows what RAG actually pulls for a question. */
rag.post('/search', async (c) => {
  const userId = c.get('uid');
  const { query, topK } = await c.req.json<{ query?: string; topK?: number }>();

  if (!query?.trim()) return c.json({ error: 'query is required' }, 400);

  const chunks = await retrieveChunks(query.trim(), userId, Math.min(topK ?? 10, 25));
  return c.json({ query, results: chunks });
});

rag.get('/stats', async (c) => {
  return c.json(await documentStats(c.get('uid')));
});

rag.delete('/documents', async (c) => {
  const removed = await clearDocuments(c.get('uid'));
  return c.json({ success: true, removed });
});

export { rag };
