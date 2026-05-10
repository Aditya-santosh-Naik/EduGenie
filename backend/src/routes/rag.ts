import { Hono } from 'hono';
import { parsePDF } from '../services/pdfParser.js';
import { ingestDocument } from '../services/rag.js';

const rag = new Hono();

rag.post('/upload', async (c) => {
  const formData = await c.req.formData();
  const file = formData.get('file') as File;
  const userId = formData.get('userId') as string;

  if (!file || !userId) {
    return c.json({ error: 'file and userId required' }, 400);
  }

  if (file.type !== 'application/pdf') {
    return c.json({ error: 'Only PDF files are supported' }, 400);
  }

  const buffer = Buffer.from(await file.arrayBuffer());

  // Parse PDF → markdown via Python Docling service
  const markdown = await parsePDF(buffer);
  if (!markdown) {
    return c.json(
      { error: 'PDF parsing failed. Make sure the PDF service is running on port 8004.' },
      500
    );
  }

  // Chunk → embed → store in Qdrant
  const chunkCount = await ingestDocument(markdown, {
    source: file.name,
    userId
  });

  return c.json({
    success: true,
    chunkCount,
    message: `Processed ${chunkCount} chunks from ${file.name}`
  });
});

export { rag };
