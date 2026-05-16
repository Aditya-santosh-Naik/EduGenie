// Prevents LLM and image/video gen from running simultaneously on 6GB VRAM
// Both Ollama and ComfyUI share the same GPU — they CANNOT overlap

let vramInUse = false;
const queue: Array<() => void> = [];

export async function acquireVRAM(): Promise<() => void> {
  return new Promise((resolve) => {
    const release = () => {
      vramInUse = false;
      queue.shift()?.();
    };
    if (!vramInUse) {
      vramInUse = true;
      resolve(release);
    } else {
      queue.push(() => {
        vramInUse = true;
        resolve(release);
      });
    }
  });
}

export async function withVRAM<T>(task: () => Promise<T>): Promise<T> {
  const release = await acquireVRAM();
  try {
    return await task();
  } finally {
    release();
  }
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

// Call this before Ollama to ensure ComfyUI has released VRAM
export async function unloadComfyUI(): Promise<void> {
  try {
    await fetch(`${process.env.COMFYUI_URL || 'http://localhost:8188'}/free`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ unload_models: true, free_memory: true })
    });
    await new Promise(r => setTimeout(r, 2000));
  } catch {
    // ComfyUI might not be running
  }
}
