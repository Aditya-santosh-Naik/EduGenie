import 'dotenv/config';
import { serve } from '@hono/node-server';
import { Hono } from 'hono';
import { logger } from 'hono/logger';
import { corsMiddleware } from './middleware/cors.js';
import { rateLimitMiddleware } from './middleware/rateLimit.js';
import { explain } from './routes/explain.js';
import { quiz } from './routes/quiz.js';
import { rag } from './routes/rag.js';
import { media } from './routes/media.js';
import { voice } from './routes/voice.js';
import { gamification } from './routes/gamification.js';

const app = new Hono();

// Global middleware
app.use('*', logger());
app.use('*', corsMiddleware);
app.use('/api/*', rateLimitMiddleware);

// Health check
app.get('/health', (c) =>
  c.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    services: {
      ollama: process.env.OLLAMA_BASE_URL,
      comfyui: process.env.COMFYUI_URL,
      qdrant: process.env.QDRANT_URL,
      redis: process.env.REDIS_URL,
      tts: process.env.TTS_SERVICE_URL,
      stt: process.env.STT_SERVICE_URL,
      pdf: process.env.PDF_SERVICE_URL,
      reranker: process.env.RERANKER_SERVICE_URL
    }
  })
);

// API routes
app.route('/api/explain', explain);
app.route('/api/quiz', quiz);
app.route('/api/rag', rag);
app.route('/api/media', media);
app.route('/api/voice', voice);
app.route('/api/gamification', gamification);

// 404 fallback
app.notFound((c) => c.json({ error: 'Not found' }, 404));

// Error handler
app.onError((err, c) => {
  console.error('[server] Unhandled error:', err);
  return c.json({ error: 'Internal server error' }, 500);
});

const port = parseInt(process.env.PORT || '3001');
console.log(`
╔══════════════════════════════════════╗
║    EduGenie Backend — v1.0.0        ║
║    http://localhost:${port}            ║
╚══════════════════════════════════════╝
`);

serve({ fetch: app.fetch, port });
