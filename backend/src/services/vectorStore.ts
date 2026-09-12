// Pluggable vector store.
//
// Qdrant is the production backend, but it only ships as a container and Docker
// is not available on every machine this runs on. So the store picks a backend
// at first use: Qdrant when it answers, otherwise an embedded index that keeps
// vectors in memory and mirrors them to .data/vectors.json.
//
// The embedded backend is a brute-force cosine scan. That is O(n) per query,
// which is fine for the thousands of chunks a single learner uploads and keeps
// RAG working with no external services at all.

import { QdrantClient } from '@qdrant/js-client-rest';
import { mkdir, readFile, writeFile, rename } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import path from 'node:path';

export interface VectorPoint {
  id: string;
  vector: number[];
  payload: Record<string, unknown>;
}

export interface SearchHit {
  score: number;
  payload: Record<string, unknown>;
}

interface Backend {
  readonly name: 'qdrant' | 'embedded';
  ensure(vectorSize: number): Promise<void>;
  upsert(points: VectorPoint[]): Promise<void>;
  search(vector: number[], limit: number, filter: Record<string, unknown>): Promise<SearchHit[]>;
  count(filter: Record<string, unknown>): Promise<number>;
  clear(filter: Record<string, unknown>): Promise<number>;
}

const COLLECTION = process.env.QDRANT_COLLECTION || 'edugenie_docs';
const DATA_DIR = path.resolve(process.cwd(), '.data');
const VECTORS_FILE = path.join(DATA_DIR, 'vectors.json');

// ── Qdrant backend ────────────────────────────────────────────────

class QdrantBackend implements Backend {
  readonly name = 'qdrant' as const;
  private client: QdrantClient;
  private ready = false;

  constructor(url: string) {
    this.client = new QdrantClient({ url });
  }

  async ensure(vectorSize: number): Promise<void> {
    if (this.ready) return;
    try {
      await this.client.getCollection(COLLECTION);
    } catch {
      await this.client.createCollection(COLLECTION, {
        vectors: { size: vectorSize, distance: 'Cosine' }
      });
      console.log(`[rag] created Qdrant collection ${COLLECTION} (dim ${vectorSize})`);
    }
    this.ready = true;
  }

  async upsert(points: VectorPoint[]): Promise<void> {
    await this.client.upsert(COLLECTION, { points, wait: true });
  }

  async search(vector: number[], limit: number, filter: Record<string, unknown>): Promise<SearchHit[]> {
    const must = Object.entries(filter).map(([key, value]) => ({ key, match: { value } }));
    const results = await this.client.search(COLLECTION, {
      vector,
      limit,
      ...(must.length ? { filter: { must } } : {}),
      with_payload: true
    });
    return results.map(r => ({
      score: r.score ?? 0,
      payload: (r.payload ?? {}) as Record<string, unknown>
    }));
  }

  async count(filter: Record<string, unknown>): Promise<number> {
    const must = Object.entries(filter).map(([key, value]) => ({ key, match: { value } }));
    const res = await this.client.count(COLLECTION, {
      ...(must.length ? { filter: { must } } : {}),
      exact: true
    });
    return res.count;
  }

  async clear(filter: Record<string, unknown>): Promise<number> {
    const before = await this.count(filter);
    const must = Object.entries(filter).map(([key, value]) => ({ key, match: { value } }));
    await this.client.delete(COLLECTION, { filter: must.length ? { must } : {}, wait: true });
    return before;
  }
}

// ── Embedded backend ──────────────────────────────────────────────

function cosine(a: number[], b: number[]): number {
  let dot = 0;
  let na = 0;
  let nb = 0;
  const len = Math.min(a.length, b.length);
  for (let i = 0; i < len; i++) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  if (na === 0 || nb === 0) return 0;
  return dot / (Math.sqrt(na) * Math.sqrt(nb));
}

function matches(payload: Record<string, unknown>, filter: Record<string, unknown>): boolean {
  return Object.entries(filter).every(([key, value]) => payload[key] === value);
}

class EmbeddedBackend implements Backend {
  readonly name = 'embedded' as const;
  private points: VectorPoint[] | null = null;
  private writing: Promise<void> = Promise.resolve();

  async ensure(): Promise<void> {
    if (this.points) return;
    try {
      this.points = JSON.parse(await readFile(VECTORS_FILE, 'utf8')) as VectorPoint[];
      console.log(`[rag] embedded index loaded — ${this.points.length} vectors`);
    } catch {
      this.points = [];
    }
  }

  /** Serialised so two concurrent ingests can't interleave a read-modify-write. */
  private persist(): Promise<void> {
    this.writing = this.writing.then(async () => {
      await mkdir(DATA_DIR, { recursive: true });
      const tmp = `${VECTORS_FILE}.${randomUUID().slice(0, 8)}.tmp`;
      await writeFile(tmp, JSON.stringify(this.points ?? []), 'utf8');
      await rename(tmp, VECTORS_FILE);
    });
    return this.writing;
  }

  async upsert(points: VectorPoint[]): Promise<void> {
    await this.ensure();
    const incoming = new Set(points.map(p => p.id));
    this.points = [...this.points!.filter(p => !incoming.has(p.id)), ...points];
    await this.persist();
  }

  async search(vector: number[], limit: number, filter: Record<string, unknown>): Promise<SearchHit[]> {
    await this.ensure();
    return this.points!
      .filter(p => matches(p.payload, filter))
      .map(p => ({ score: cosine(vector, p.vector), payload: p.payload }))
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);
  }

  async count(filter: Record<string, unknown>): Promise<number> {
    await this.ensure();
    return this.points!.filter(p => matches(p.payload, filter)).length;
  }

  async clear(filter: Record<string, unknown>): Promise<number> {
    await this.ensure();
    const before = this.points!.length;
    this.points = this.points!.filter(p => !matches(p.payload, filter));
    await this.persist();
    return before - this.points.length;
  }
}

// ── Backend selection ─────────────────────────────────────────────

let selected: Backend | null = null;
let selecting: Promise<Backend> | null = null;

async function qdrantReachable(url: string): Promise<boolean> {
  try {
    const res = await fetch(`${url}/collections`, { signal: AbortSignal.timeout(1500) });
    return res.ok;
  } catch {
    return false;
  }
}

async function pickBackend(): Promise<Backend> {
  const url = process.env.QDRANT_URL || 'http://localhost:6333';
  if (await qdrantReachable(url)) {
    console.log(`[rag] vector backend: qdrant (${url})`);
    return new QdrantBackend(url);
  }
  console.log('[rag] vector backend: embedded (Qdrant unreachable — using .data/vectors.json)');
  return new EmbeddedBackend();
}

async function backend(): Promise<Backend> {
  if (selected) return selected;
  selecting ??= pickBackend().then(b => (selected = b));
  return selecting;
}

/** Which backend is in use, for /health. Null until the first RAG call. */
export function activeBackend(): string | null {
  return selected?.name ?? null;
}

export async function storeVectors(points: VectorPoint[], vectorSize: number): Promise<void> {
  const b = await backend();
  await b.ensure(vectorSize);
  await b.upsert(points);
}

export async function searchVectors(
  vector: number[],
  limit: number,
  filter: Record<string, unknown>
): Promise<SearchHit[]> {
  const b = await backend();
  await b.ensure(vector.length);
  return b.search(vector, limit, filter);
}

export async function countVectors(filter: Record<string, unknown>): Promise<number> {
  const b = await backend();
  await b.ensure(parseInt(process.env.QDRANT_VECTOR_SIZE || '768', 10));
  return b.count(filter);
}

export async function clearVectors(filter: Record<string, unknown>): Promise<number> {
  const b = await backend();
  await b.ensure(parseInt(process.env.QDRANT_VECTOR_SIZE || '768', 10));
  return b.clear(filter);
}
