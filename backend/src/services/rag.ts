import { QdrantClient } from '@qdrant/js-client-rest';
import { generateEmbedding } from './llm.js';
import { v4 as uuidv4 } from 'uuid';

const qdrant = new QdrantClient({ url: process.env.QDRANT_URL || 'http://localhost:6333' });
const COLLECTION = process.env.QDRANT_COLLECTION || 'edugenie_docs';
const CHUNK_SIZE = 512;
const CHUNK_OVERLAP = 50;

// Ensure collection exists on startup
async function ensureCollection(): Promise<void> {
  try {
    await qdrant.getCollection(COLLECTION);
  } catch {
    const vectorSize = parseInt(process.env.QDRANT_VECTOR_SIZE || '768', 10);
    await qdrant.createCollection(COLLECTION, {
      vectors: { size: vectorSize, distance: 'Cosine' }
    });
    console.log(`[rag] Created Qdrant collection: ${COLLECTION} with vector size: ${vectorSize}`);
  }
}

function chunkText(text: string): string[] {
  const words = text.split(/\s+/);
  const chunks: string[] = [];
  let i = 0;
  while (i < words.length) {
    chunks.push(words.slice(i, i + CHUNK_SIZE).join(' '));
    i += CHUNK_SIZE - CHUNK_OVERLAP;
  }
  return chunks.filter(c => c.trim().length > 50);
}

export async function ingestDocument(
  text: string,
  metadata: { source: string; userId: string }
): Promise<number> {
  await ensureCollection();
  const chunks = chunkText(text);
  const points = [];

  for (let i = 0; i < chunks.length; i++) {
    const embedding = await generateEmbedding(chunks[i]);
    points.push({
      id: uuidv4(),
      vector: embedding,
      payload: { text: chunks[i], ...metadata, chunkIndex: i }
    });
  }

  await qdrant.upsert(COLLECTION, { points });
  console.log(`[rag] Ingested ${chunks.length} chunks from ${metadata.source}`);
  return chunks.length;
}

export async function retrieveContext(
  query: string,
  userId: string,
  topK = 10
): Promise<string> {
  await ensureCollection();
  const queryEmbedding = await generateEmbedding(query);

  const results = await qdrant.search(COLLECTION, {
    vector: queryEmbedding,
    limit: topK,
    filter: {
      must: [{ key: 'userId', match: { value: userId } }]
    },
    with_payload: true
  });

  if (results.length === 0) return '';

  // Rerank via Python reranker service
  try {
    const chunks = results.map(r => (r.payload as Record<string, unknown>).text as string);
    const reranked = await fetch(`${process.env.RERANKER_SERVICE_URL}/rerank`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query, chunks, top_k: 3 }),
      signal: AbortSignal.timeout(10000)
    }).then(r => r.json()) as { results: Array<{ text: string; score: number }> };

    return reranked.results.map((r) => r.text).join('\n\n---\n\n');
  } catch {
    // Reranker unavailable — return top 3 by vector similarity
    console.warn('[rag] Reranker unavailable — using vector similarity only');
    return results
      .slice(0, 3)
      .map(r => (r.payload as Record<string, unknown>).text as string)
      .join('\n\n---\n\n');
  }
}
