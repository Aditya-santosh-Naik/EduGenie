import { withVRAM, acquireVRAM, unloadComfyUI, ensureOllamaOnGpu } from './vramLock.js';
import { getCached, setCached, contextScope } from './cache.js';

const SYSTEM_PROMPT = `You are EduGenie, an expert AI teacher for students aged 10-18.
You NEVER behave like a chatbot. You always respond with ONLY a valid JSON object.

RESPONSE FORMAT — return this exact JSON structure:
{
  "explanationText": "Full structured explanation using ## headings. Use ## Introduction, ## Key Concepts, ## Examples, ## Real-Life Applications, ## Common Mistakes, ## Summary. Write like a patient encouraging teacher. Use analogies. Be scientifically accurate.",
  "storyboard": [
    {"id": "f1", "caption": "scene description", "image_prompt": "detailed educational image prompt"}
  ],
  "images": [
    {"id": "img1", "prompt": "A comprehensive educational infographic of [topic]. The image must synthesize the entire concept in a single unified diagram, textbook illustration style, safe for students, no humans"}
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
- When the user message contains STUDENT'S OWN MATERIAL, that material is the
  authoritative source for this topic. Build the explanation from its facts,
  names and figures, and never contradict it or swap in your own version of the
  subject. If the topic is one you do not recognise, the material is all there
  is to know about it — teach from it rather than inventing a different topic
  that happens to share the name.
- explanationText MUST use ## headings, be at least 400 words, teach clearly
- quiz MUST have exactly 4 questions, each with exactly 4 options
- diagram code MUST be valid Mermaid.js syntax
- image prompts MUST be comprehensive visual summaries
- You MUST insert image placeholders like [IMAGE_PLACEHOLDER_img1] directly inside the explanationText where the visual aid is most relevant
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
  context?: string,
  signal?: AbortSignal,
  userId = ''
): Promise<AsyncGenerator<string>> {
  // Cache is scoped to the material the answer was built from, so a grounded
  // explanation is never replayed to a different student or after their
  // documents change.
  const scope = contextScope(userId, context ?? '');
  const cached = await getCached(topic, mode, level, scope);
  if (cached) {
    return (async function* () {
      yield JSON.stringify(cached);
    })();
  }

  const userPrompt = `Topic: "${topic}"
Learning level: ${level}
Explanation mode: ${mode}
${context ? `--- STUDENT'S OWN MATERIAL (authoritative — teach from this) ---\n${context}\n--- END OF STUDENT'S OWN MATERIAL ---\n` : ''}
Generate a complete structured educational explanation for this topic.`;

  const releaseVRAM = await acquireVRAM();
  try {
    await unloadComfyUI();
    await ensureOllamaOnGpu();
    const res = await fetch(`${process.env.OLLAMA_BASE_URL}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal,
      body: JSON.stringify({
        model: process.env.LLM_MODEL,
        format: 'json',
        stream: true,
        keep_alive: "5m",
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
      try {
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
                  const parsedContent = JSON.parse(fullContent);
                  await setCached(topic, mode, level, parsedContent, scope);
                } catch {
                  /* skip */
                }
              }
            } catch {
              /* skip */
            }
          }
        }
      } finally {
        releaseVRAM();
      }
    }

    return streamTokens();
  } catch (err) {
    releaseVRAM();
    throw err;
  }
}

export async function generateEmbedding(text: string): Promise<number[]> {
  const releaseVRAM = await acquireVRAM();
  try {
    await unloadComfyUI();
    await ensureOllamaOnGpu();
    const res = await fetch(`${process.env.OLLAMA_BASE_URL}/api/embeddings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: process.env.EMBED_MODEL, prompt: text, keep_alive: "5m" })
    });
    const data = await res.json() as { embedding: number[] };
    return data.embedding;
  } finally {
    releaseVRAM();
  }
}

// ── Structured extras ──────────────────────────────────────────
// A small local model reliably fills in ONE simple schema but silently drops
// most fields of a large one — qwen2.5:3b returns only `explanationText` for
// the main prompt above. So the visual aids are requested separately, with a
// short schema, the same way quiz generation already works.

export interface LearningStep {
  /** Button label shown to the student. */
  title: string;
  /** What gets searched when they click it. */
  topic: string;
  level: 'beginner' | 'intermediate' | 'advanced';
  /** One line on why this comes next. */
  why: string;
}

export interface ExplanationExtras {
  images: Array<{ id: string; prompt: string }>;
  diagram: { type: string; code: string } | null;
  applications: string[];
  nextSteps: LearningStep[];
}

const VISUALS_PROMPT = `You generate visual aids for a school lesson.
Respond with ONLY a JSON object — no commentary.

Here is a complete example for the topic "The Human Heart". Follow this SHAPE,
but write entirely new content about the topic you are actually given:

{
  "images": [
    {"id": "img1", "prompt": "labelled cross-section of the human heart showing the four chambers, valves and the direction of blood flow, textbook illustration, clean white background"},
    {"id": "img2", "prompt": "diagram comparing oxygenated and deoxygenated blood circulation through the heart and lungs, colour coded red and blue, textbook illustration"}
  ],
  "diagram": {"type": "mermaid", "code": "graph TD\\n  A[Body] --> B[Right Atrium]\\n  B --> C[Right Ventricle]\\n  C --> D[Lungs]\\n  D --> E[Left Atrium]"},
  "applications": [
    "Doctors use ECG readings to detect irregular heart rhythms",
    "Pacemakers restore a steady heartbeat in patients with arrhythmia",
    "Fitness trackers estimate cardiac output from resting heart rate"
  ],
  "nextSteps": [
    {"title": "Go deeper into heart valves", "topic": "Heart valves and blood flow", "level": "intermediate", "why": "You know the chambers — now learn what keeps blood moving one way"},
    {"title": "Learn the circulatory system", "topic": "The human circulatory system", "level": "beginner", "why": "The heart is one part of a bigger transport network"},
    {"title": "Study blood pressure", "topic": "How blood pressure works", "level": "intermediate", "why": "Explains why the heart pumps with different force"}
  ]
}

RULES:
- NEVER copy the example text above — it is about the heart, not your topic
- exactly 2 images and exactly 3 applications, all specific to the given topic
- each image prompt names concrete things a student would see in the picture
- applications are real, concrete uses — not "use 1", "use 2"
- diagram code is valid Mermaid flowchart syntax with \\n between lines
- output nothing outside the JSON object`;

// The model sometimes echoes the schema back instead of filling it in. Anything
// that still looks like a template is treated as a failed generation.
const TEMPLATE_ECHO =
  /^(real[- ]world )?(use|application|example|item|step|point|concept)\s*\d+\.?$|real[- ]world (use|application)\s*\d|detailed prompt for|prompt for (a|an) (second |different )?educational|A\[First\]|^option [abcd]$|^string$|lorem ipsum/i;

function looksLikeTemplate(value: string): boolean {
  return TEMPLATE_ECHO.test(value.trim());
}

export async function generateVisuals(
  topic: string,
  level: string
): Promise<ExplanationExtras | null> {
  try {
    const res = await fetch(`${process.env.OLLAMA_BASE_URL}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: AbortSignal.timeout(120_000),
      body: JSON.stringify({
        model: process.env.LLM_MODEL,
        format: 'json',
        stream: false,
        keep_alive: '5m',
        messages: [
          { role: 'system', content: VISUALS_PROMPT },
          { role: 'user', content: `Topic: "${topic}"\nLevel: ${level}` }
        ],
        options: { temperature: 0.4, num_ctx: 4096 }
      })
    });

    if (!res.ok) return null;

    const data = (await res.json()) as { message?: { content?: string } };
    const parsed = JSON.parse(data.message?.content ?? '{}') as Partial<ExplanationExtras>;

    const images = (Array.isArray(parsed.images) ? parsed.images : [])
      .filter((i) => i && typeof i.prompt === 'string' && i.prompt.trim() && !looksLikeTemplate(i.prompt))
      .map((image, index) => ({ id: image.id || `img${index + 1}`, prompt: image.prompt }));

    const levels = ['beginner', 'intermediate', 'advanced'] as const;
    const nextSteps = (Array.isArray(parsed.nextSteps) ? parsed.nextSteps : [])
      .filter(
        (step): step is LearningStep =>
          !!step &&
          typeof step.title === 'string' && step.title.trim().length > 0 &&
          typeof step.topic === 'string' && step.topic.trim().length > 0 &&
          !looksLikeTemplate(step.title) && !looksLikeTemplate(step.topic)
      )
      .map((step) => ({
        title: step.title.trim(),
        topic: step.topic.trim(),
        level: levels.includes(step.level) ? step.level : 'intermediate',
        why: typeof step.why === 'string' ? step.why.trim() : ''
      }))
      .slice(0, 4);

    const code = parsed.diagram?.code;
    return {
      nextSteps,
      images,
      diagram: typeof code === 'string' && code.trim() && !looksLikeTemplate(code)
        ? { type: parsed.diagram?.type || 'mermaid', code }
        : null,
      applications: (Array.isArray(parsed.applications) ? parsed.applications : [])
        .filter((a): a is string => typeof a === 'string' && a.trim().length > 0 && !looksLikeTemplate(a))
    };
  } catch {
    // Visual aids are a bonus — never fail the explanation because of them.
    return null;
  }
}
