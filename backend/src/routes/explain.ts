import { Hono } from 'hono';
import { streamSSE } from 'hono/streaming';
import { isSafe } from '../services/safety.js';
import { generateExplanation } from '../services/llm.js';
import { retrieveContext } from '../services/rag.js';
import { generateImage } from '../services/imageGen.js';
import { searchYouTube } from '../services/youtube.js';

const explain = new Hono();

explain.post('/', async (c) => {
  try {
    const { topic, mode = 'text', level = 'beginner', userId } = await c.req.json();

    if (!topic || typeof topic !== 'string') {
      return c.json({ error: 'topic is required' }, 400);
    }

    // 1. Safety check — skip if Ollama is down (fail open)
    let safety: { safe: boolean; reason?: string };
    try {
      safety = await isSafe(topic);
    } catch {
      // Ollama not running — skip safety check, don't block the request
      safety = { safe: true };
    }
    if (!safety.safe) {
      return c.json(
        { error: 'This topic cannot be explained in this context.', reason: safety.reason },
        400
      );
    }

    // 2. Retrieve RAG context — skip if Qdrant is down
    let context = '';
    if (userId) {
      try {
        context = await retrieveContext(topic, userId);
      } catch {
        // Qdrant not running — proceed without RAG context
      }
    }

    // 3. Stream LLM response via SSE
    return streamSSE(c, async (stream) => {
      try {
        const generator = await generateExplanation(topic, mode, level, context, c.req.raw.signal);
        let fullJson = '';

        for await (const token of generator) {
          fullJson += token;
          await stream.writeSSE({ data: token, event: 'token' });
        }

        // After explanation is done, fetch YouTube video
        try {
          const parsed = JSON.parse(fullJson);
          if (parsed.youtube?.shouldInclude) {
            const video = await searchYouTube(parsed.youtube.query || topic);
            if (video) {
              await stream.writeSSE({
                data: JSON.stringify({ youtube: video }),
                event: 'youtube'
              });
            }
          }
        } catch {
          /* non-critical */
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Unknown error';
        const isConnectionError = message.includes('ECONNREFUSED') || message.includes('fetch failed');
        await stream.writeSSE({
          data: JSON.stringify({
            error: isConnectionError
              ? `Ollama is not running. Please start Ollama with: ollama serve`
              : `Failed to generate explanation: ${message}`
          }),
          event: 'error'
        });
      }

      await stream.writeSSE({ data: '[DONE]', event: 'done' });
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    const isConnectionError = message.includes('ECONNREFUSED') || message.includes('fetch failed');
    return c.json({
      error: isConnectionError
        ? `Ollama is not running. Start Ollama with: ollama serve`
        : `Internal error: ${message}`
    }, isConnectionError ? 503 : 500);
  }
});

// Generate a single image for a prompt
explain.post('/image', async (c) => {
  const { prompt } = await c.req.json();
  if (!prompt) return c.json({ error: 'prompt required' }, 400);

  const imageUrl = await generateImage(prompt);
  return c.json({ imageUrl });
});

export { explain };
