import { Hono } from 'hono';
import { streamSSE } from 'hono/streaming';
import { isSafe } from '../services/safety.js';
import { withVRAM } from '../services/vramLock.js';
import { getCached, setCached } from '../services/cache.js';

const quiz = new Hono();

const QUIZ_SYSTEM_PROMPT = `You are EduGenie Quiz Generator for students aged 10-18.
Generate a quiz as ONLY a valid JSON object with this exact structure:
{
  "topic": "the topic name",
  "questions": [
    {
      "id": "q1",
      "question": "Clear, educational question?",
      "options": ["Option A", "Option B", "Option C", "Option D"],
      "answerIndex": 0,
      "correctExplanation": "Why this is the correct answer.",
      "difficulty": "beginner"
    }
  ]
}

RULES:
- Generate exactly 5 questions per quiz
- Each question must have exactly 4 options
- answerIndex is 0-based
- Questions should test understanding, not just memory
- Explanations should teach, not just state the answer
- NEVER return anything outside the JSON object`;

quiz.post('/generate', async (c) => {
  try {
    const { topic, level = 'beginner', questionCount = 5 } = await c.req.json();

    if (!topic) return c.json({ error: 'topic is required' }, 400);

    let safety: { safe: boolean; reason?: string };
    try {
      safety = await isSafe(topic);
    } catch {
      safety = { safe: true };
    }
    if (!safety.safe) {
      return c.json({ error: 'Cannot generate quiz for this topic.', reason: safety.reason }, 400);
    }

  // Check cache
  const cacheKey = `quiz:${topic}:${level}`;
  const cached = await getCached(topic, 'quiz', level);
  if (cached) return c.json(cached);

  return streamSSE(c, async (stream) => {
    try {
      const generator = await withVRAM(async () => {
        const res = await fetch(`${process.env.OLLAMA_BASE_URL}/api/chat`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            model: process.env.LLM_MODEL,
            format: 'json',
            stream: true,
            messages: [
              { role: 'system', content: QUIZ_SYSTEM_PROMPT },
              {
                role: 'user',
                content: `Generate a ${level}-level quiz with ${questionCount} questions about: "${topic}"`
              }
            ],
            options: { temperature: 0.7, num_ctx: 4096 }
          })
        });

        if (!res.ok || !res.body) throw new Error('Ollama request failed');

        async function* streamTokens(): AsyncGenerator<string> {
          const reader = (res.body as ReadableStream<Uint8Array>).getReader();
          const decoder = new TextDecoder();
          let fullContent = '';

          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            const chunk = decoder.decode(value);
            const lines = chunk.split('\n').filter(Boolean);
            for (const line of lines) {
              try {
                const parsed = JSON.parse(line);
                if (parsed.message?.content) {
                  fullContent += parsed.message.content;
                  yield parsed.message.content;
                }
                if (parsed.done) {
                  try {
                    const cleanText = fullContent.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
                    const parsedContent = JSON.parse(cleanText);
                    await setCached(topic, 'quiz', level, parsedContent);
                  } catch { /* don't cache partial */ }
                }
              } catch { /* skip malformed */ }
            }
          }
        }

        return streamTokens();
      });

      for await (const token of generator) {
        await stream.writeSSE({ data: token, event: 'token' });
      }
    } catch {
      await stream.writeSSE({
        data: JSON.stringify({ error: 'Failed to generate quiz' }),
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
        ? 'Ollama is not running. Start Ollama with: ollama serve'
        : `Internal error: ${message}`
    }, isConnectionError ? 503 : 500);
  }
});

// Validate a quiz answer and return XP
quiz.post('/validate', async (c) => {
  const { questionId, selectedIndex, correctIndex } = await c.req.json();
  const isCorrect = selectedIndex === correctIndex;

  return c.json({
    correct: isCorrect,
    xpEarned: isCorrect ? 25 : 5, // participation XP even for wrong answers
    questionId
  });
});

export { quiz };
