import { withVRAM, unloadOllama } from './vramLock.js';
import { v4 as uuidv4 } from 'uuid';

const COMFYUI_URL = process.env.COMFYUI_URL || 'http://localhost:8188';

function buildFluxWorkflow(prompt: string) {
  const safePrompt = `educational diagram, textbook illustration style, clean white background, labeled, safe for students, no humans, no text: ${prompt}`;
  const clientId = uuidv4();
  return {
    client_id: clientId,
    prompt: {
      "1": {
        "class_type": "UnetLoaderGGUF",
        "inputs": { "unet_name": "flux1-schnell-Q4_0.gguf" }
      },
      "2": {
        "class_type": "DualCLIPLoader",
        "inputs": {
          "clip_name1": "t5xxl_fp8_e4m3fn.safetensors",
          "clip_name2": "clip_l.safetensors",
          "type": "flux"
        }
      },
      "3": {
        "class_type": "VAELoader",
        "inputs": { "vae_name": "ae.safetensors" }
      },
      "4": {
        "class_type": "CLIPTextEncode",
        "inputs": { "text": safePrompt, "clip": ["2", 0] }
      },
      "5": {
        "class_type": "EmptyLatentImage",
        "inputs": { "width": 1024, "height": 1024, "batch_size": 1 }
      },
      "6": {
        "class_type": "KSampler",
        "inputs": {
          "model": ["1", 0],
          "positive": ["4", 0],
          "negative": ["4", 0],
          "latent_image": ["5", 0],
          "steps": 4,
          "cfg": 1.0,
          "sampler_name": "euler",
          "scheduler": "simple",
          "seed": Math.floor(Math.random() * 999999999),
          "denoise": 1.0
        }
      },
      "7": {
        "class_type": "VAEDecode",
        "inputs": { "samples": ["6", 0], "vae": ["3", 0] }
      },
      "8": {
        "class_type": "SaveImage",
        "inputs": { "images": ["7", 0], "filename_prefix": "edugenie_img" }
      }
    }
  };
}

async function pollComfyUI(promptId: string, maxWait = 120000): Promise<string | null> {
  const start = Date.now();
  while (Date.now() - start < maxWait) {
    try {
      const res = await fetch(`${COMFYUI_URL}/history/${promptId}`);
      const history = await res.json() as Record<string, {
        outputs: Record<string, { images: Array<{ filename: string; subfolder: string }> }>;
      }>;
      if (history[promptId]?.outputs?.["8"]?.images?.[0]) {
        const img = history[promptId].outputs["8"].images[0];
        return `${COMFYUI_URL}/view?filename=${img.filename}&subfolder=${img.subfolder}&type=output`;
      }
    } catch {
      /* ComfyUI still processing */
    }
    await new Promise(r => setTimeout(r, 2000));
  }
  return null;
}

export async function generateImage(prompt: string): Promise<string | null> {
  // Check ComfyUI is available — never crash if offline
  try {
    await fetch(`${COMFYUI_URL}/system_stats`, { signal: AbortSignal.timeout(3000) });
  } catch {
    console.warn('[imageGen] ComfyUI not available — skipping image generation');
    return null;
  }

  return withVRAM(async () => {
    await unloadOllama(); // Free VRAM from LLM before image gen
    const workflow = buildFluxWorkflow(prompt);
    try {
      const res = await fetch(`${COMFYUI_URL}/prompt`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(workflow)
      });
      const { prompt_id } = await res.json() as { prompt_id: string };
      return await pollComfyUI(prompt_id);
    } catch (e) {
      console.error('[imageGen] ComfyUI error:', e);
      return null;
    }
  });
}
