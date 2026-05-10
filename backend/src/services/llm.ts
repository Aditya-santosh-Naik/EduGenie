import { withVRAM } from './vramLock.js';
import { getCached, setCached } from './cache.js';

const SYSTEM_PROMPT = `You are EduGenie, an expert AI teacher for students aged 10-18.
You NEVER behave like a chatbot. You always respond with ONLY a valid JSON object.

RESPONSE FORMAT — return this exact JSON structure:
{
  "explanationText": "Full structured explanation using ## headings. Use ## Introduction, ## Key Concepts, ## Examples, ## Real-Life Applications, ## Common Mistakes, ## Summary. Write like a patient encouraging teacher. Use analogies. Be scientifically accurate.",
  "storyboard": [
    {"id": "f1", "caption": "scene description", "image_prompt": "detailed educational image prompt"}
  ],
  "images": [
    {"id": "img1", "prompt": "educational diagram of [topic], textbook illustration style, clean white background, labeled, no humans"}
  ],
  "audio": {"shouldGenerate": true, "ttsText": "same as explanationText"},
  "youtube": {"shouldInclude": true, "query": "[topic] explained for students"},
  "applications": ["Real-world application 1", "Real-world application 2", "Real-world application 3"],
  "diagram": {"type": "mermaid", "code": "graph TD\\n  A[concept] --> B[subconcept]"},
  "quiz": [
    {
      "id": "q1",
      "question": "Multiple choice question about the topic?",
      "options": ["Option A", "Option B", "Option C", "Option D"],
      "answerIndex": 1,
      "correctExplanation": "Why this answer is correct, tied to the explanation above."
    }
  ]
}

RULES:
- explanationText MUST use ## headings, be at least 400 words, teach clearly
- quiz MUST have exactly 4 questions, each with exactly 4 options
- diagram code MUST be valid Mermaid.js syntax
- image prompts MUST be safe for students, no people, educational style
- NEVER return anything outside the JSON object
- NEVER truncate the response`;

export interface ExplanationResponse {
  explanationText: string;
  storyboard: Array<{ id: string; caption: string; image_prompt: string }>;
  images: Array<{ id: string; prompt: string }>;
  audio: { shouldGenerate: boolean; ttsText: string };
  youtube: { shouldInclude: boolean; query: string };
  applications: string[];
  diagram: { type: string; code: string };
  quiz: Array<{
    id: string;
    question: string;
    options: string[];
    answerIndex: number;
    correctExplanation: string;
  }>;
}

export async function generateExplanation(
  topic: string,
  mode: 'text' | 'images' | 'story' | 'story+video',
  level: 'beginner' | 'intermediate' | 'advanced',
  context?: string
): Promise<AsyncGenerator<string>> {
  // Check cache first — same topic = serve cache, never re-run LLM
  const cached = await getCached(topic, mode, level);
  if (cached) {
    return (async function* () {
      yield JSON.stringify(cached);
    })();
  }

  const userPrompt = `Topic: "${topic}"
Learning level: ${level}
Explanation mode: ${mode}
${context ? `Relevant context from student's uploaded materials:\n${context}\n` : ''}
Generate a complete structured educational explanation for this topic.`;

  return withVRAM(async () => {
    const res = await fetch(`${process.env.OLLAMA_BASE_URL}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: process.env.LLM_MODEL,
        format: 'json',
        stream: true,
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: userPrompt }
        ],
        options: { temperature: 0.7, num_ctx: 8192 }
      })
    });

    if (!res.ok || !res.body) {
      const errBody = res.body ? await res.text() : 'No response body';
      console.error(`[llm] Ollama error: status=${res.status} model=${process.env.LLM_MODEL} body=${errBody}`);
      throw new Error(`Ollama request failed (${res.status}): model "${process.env.LLM_MODEL}" — ${errBody}`);
    }

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
              // Cache the complete response
              try {
                const parsedContent = JSON.parse(fullContent);
                await setCached(topic, mode, level, parsedContent);
              } catch {
                /* partial/malformed response — don't cache */
              }
            }
          } catch {
            /* skip malformed chunks */
          }
        }
      }
    }

    return streamTokens();
  });
}

export async function generateEmbedding(text: string): Promise<number[]> {
  return withVRAM(async () => {
    const res = await fetch(`${process.env.OLLAMA_BASE_URL}/api/embeddings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: process.env.EMBED_MODEL, prompt: text })
    });
    const data = await res.json() as { embedding: number[] };
    return data.embedding;
  });
}
