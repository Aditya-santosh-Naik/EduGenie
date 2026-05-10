// Prevents LLM and image/video gen from running simultaneously on 6GB VRAM
// Both Ollama and ComfyUI share the same GPU — they CANNOT overlap

let vramInUse = false;
const queue: Array<() => void> = [];

export async function withVRAM<T>(task: () => Promise<T>): Promise<T> {
  if (!vramInUse) {
    vramInUse = true;
    try {
      return await task();
    } finally {
      vramInUse = false;
      queue.shift()?.();
    }
  }
  return new Promise((resolve, reject) => {
    queue.push(async () => {
      vramInUse = true;
      try {
        resolve(await task());
      } catch (e) {
        reject(e);
      } finally {
        vramInUse = false;
        queue.shift()?.();
      }
    });
  });
}

// Call this before ComfyUI to ensure Ollama has released VRAM
export async function unloadOllama(): Promise<void> {
  try {
    await fetch(`${process.env.OLLAMA_BASE_URL}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: process.env.LLM_MODEL,
        keep_alive: 0
      })
    });
    // Wait 2s for VRAM to actually free
    await new Promise(r => setTimeout(r, 2000));
  } catch {
    // Ollama might not be loaded — that's fine
  }
}
