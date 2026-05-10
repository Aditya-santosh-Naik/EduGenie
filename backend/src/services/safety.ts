// Uses the main LLM (already loaded) to safety-check student inputs
// No extra VRAM needed — reuses the loaded model

import { withVRAM } from './vramLock.js';

export async function isSafe(input: string): Promise<{ safe: boolean; reason?: string }> {
  try {
    return await withVRAM(async () => {
      const res = await fetch(`${process.env.OLLAMA_BASE_URL}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: process.env.LLM_MODEL,
          format: 'json',
          stream: false,
          messages: [
            {
              role: 'system',
              content: `You are a content safety classifier for a school student platform (ages 10-18).
Respond ONLY with valid JSON: {"safe": true} or {"safe": false, "reason": "brief reason"}
Classify as unsafe if the input: asks for harmful instructions, contains explicit content,
asks about weapons/drugs/violence, or is clearly inappropriate for school students.
Educational questions about biology, history, science, and sensitive topics taught in schools are SAFE.`
            },
            { role: 'user', content: `Classify this student query: "${input}"` }
          ],
          options: { temperature: 0 }
        })
      });

      const data = await res.json() as { message: { content: string } };
      return JSON.parse(data.message.content);
    });
  } catch {
    // Fail open — don't block on safety service errors
    return { safe: true };
  }
}
