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

// Ollama picks its GPU/CPU layer split ONCE, when the model is loaded, and then
// keeps that choice for the whole keep_alive window. If ComfyUI happened to be
// holding VRAM at that moment, Ollama falls back to running almost entirely on
// CPU — measured here at 7 tok/s versus 77 tok/s fully offloaded — and it will
// not re-evaluate on its own. So after freeing ComfyUI we check the split and,
// if it is poor, evict the model so the next request reloads it onto the GPU.
const MIN_GPU_FRACTION = 0.9;

interface LoadedModel {
  name?: string;
  model?: string;
  size?: number;
  size_vram?: number;
}

export async function ensureOllamaOnGpu(): Promise<void> {
  const base = process.env.OLLAMA_BASE_URL;
  const model = process.env.LLM_MODEL;
  if (!base || !model) return;

  try {
    const res = await fetch(`${base}/api/ps`, { signal: AbortSignal.timeout(5000) });
    if (!res.ok) return;

    const { models = [] } = (await res.json()) as { models?: LoadedModel[] };
    const loaded = models.find((m) => m.name === model || m.model === model);

    // Not loaded at all — the next request loads it fresh, which is what we want.
    if (!loaded?.size) return;

    const onGpu = (loaded.size_vram ?? 0) / loaded.size;
    if (onGpu >= MIN_GPU_FRACTION) return;

    console.warn(
      `[vram] ${model} is only ${Math.round(onGpu * 100)}% on GPU — evicting so it reloads onto the GPU`
    );
    await fetch(`${base}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model, keep_alive: 0 })
    });
    // Give the driver a moment to actually release the allocation.
    await new Promise((r) => setTimeout(r, 1500));
  } catch {
    // Ollama unreachable or slow — let the request proceed and fail on its own.
  }
}
