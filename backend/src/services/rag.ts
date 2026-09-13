import { generateEmbedding } from './llm.js';
import { storeVectors, searchVectors, countVectors, clearVectors, activeBackend } from './vectorStore.js';
import { v4 as uuidv4 } from 'uuid';

const CHUNK_SIZE = 512;
const CHUNK_OVERLAP = 50;

/**
 * Cosine floor for "this chunk is actually about the question". Tuned against
 * nomic-embed-text, where a genuine match on these documents scores ~0.75-0.85
 * and a same-document-but-different-section match sits around 0.68. Applied at
 * the vector stage, before reranking, because the cross-encoder returns
 * unbounded logits rather than a comparable 0-1 similarity.
 */
const MIN_RELEVANCE = Number(process.env.RAG_MIN_SCORE ?? 0.7);

export { activeBackend };

/**
 * Split on headings first so a chunk rarely straddles two sections, then pack
 * sections into ~CHUNK_SIZE word windows with an overlap so a fact sitting on a
 * boundary still appears whole in one chunk.
 */
function chunkText(text: string): string[] {
  const sections = text
    .split(/\n(?=#{1,6}\s)/)
    .map(s => s.trim())
    .filter(Boolean);

  const chunks: string[] = [];

  for (const section of sections.length ? sections : [text]) {
    const words = section.split(/\s+/);
    if (words.length <= CHUNK_SIZE) {
      chunks.push(section);
      continue;
    }
    let i = 0;
    while (i < words.length) {
      chunks.push(words.slice(i, i + CHUNK_SIZE).join(' '));
      i += CHUNK_SIZE - CHUNK_OVERLAP;
    }
  }

  return chunks.filter(c => c.trim().length > 50);
}

export interface IngestResult {
  chunkCount: number;
  backend: string;
}

export async function ingestDocument(
  text: string,
  metadata: { source: string; userId: string }
): Promise<IngestResult> {
  const chunks = chunkText(text);
  if (chunks.length === 0) {
    throw new Error('No usable text found in the document');
  }

  const points = [];
  for (let i = 0; i < chunks.length; i++) {
    const embedding = await generateEmbedding(chunks[i]);
    if (!embedding?.length) {
      throw new Error(
        `Embedding failed — is EMBED_MODEL (${process.env.EMBED_MODEL}) pulled in Ollama?`
      );
    }
    points.push({
      id: uuidv4(),
      vector: embedding,
      payload: { text: chunks[i], ...metadata, chunkIndex: i, ingestedAt: new Date().toISOString() }
    });
  }

  await storeVectors(points, points[0].vector.length);
  console.log(`[rag] ingested ${chunks.length} chunks from ${metadata.source} → ${activeBackend()}`);
  return { chunkCount: chunks.length, backend: activeBackend() ?? 'unknown' };
}

export interface RetrievedChunk {
  text: string;
  source: string;
  score: number;
}

/** Raw hits, for the /api/rag/search demo endpoint and for retrieveContext. */
export async function retrieveChunks(
  query: string,
  userId: string,
  topK = 10
): Promise<RetrievedChunk[]> {
  if ((await countVectors({ userId })) === 0) return [];

  const queryEmbedding = await generateEmbedding(query);
  if (!queryEmbedding?.length) return [];

  const results = await searchVectors(queryEmbedding, topK, { userId });

  // Nearest-neighbour search always returns *something*: ask about levers with
  // only a marine-biology PDF indexed and it will still hand back the closest
  // chunk it has. Injecting that as authoritative context makes the model weave
  // an unrelated document into the lesson. Only material that clears a
  // similarity floor is treated as relevant.
  const hits = results
    .filter(r => r.score >= MIN_RELEVANCE)
    .map(r => ({
      text: String(r.payload.text ?? ''),
      source: String(r.payload.source ?? 'unknown'),
      score: r.score
    }));

  if (hits.length === 0) return [];

  // Cross-encoder rerank when the Python service is up; vector order otherwise.
  try {
    const reranked = await fetch(`${process.env.RERANKER_SERVICE_URL}/rerank`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query, chunks: hits.map(h => h.text), top_k: Math.min(3, hits.length) }),
      signal: AbortSignal.timeout(10000)
    }).then(r => (r.ok ? r.json() : Promise.reject(new Error(String(r.status))))) as {
      results: Array<{ text: string; score: number }>;
    };

    return reranked.results.map(r => ({
      text: r.text,
      source: hits.find(h => h.text === r.text)?.source ?? 'unknown',
      score: r.score
    }));
  } catch {
    console.warn('[rag] reranker unavailable — using vector similarity order');
    return hits.slice(0, 3);
  }
}

export async function retrieveContext(query: string, userId: string, topK = 10): Promise<string> {
  const chunks = await retrieveChunks(query, userId, topK);
  return chunks.map(c => c.text).join('\n\n---\n\n');
}

export async function documentStats(userId: string): Promise<{ chunks: number; backend: string }> {
  const chunks = await countVectors({ userId });
  return { chunks, backend: activeBackend() ?? 'unknown' };
}

export async function clearDocuments(userId: string): Promise<number> {
  return clearVectors({ userId });
}
