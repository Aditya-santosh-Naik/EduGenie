import { Queue, Worker } from 'bullmq';
import { redis, redisAvailable } from './cache.js';
import { withVRAM, unloadOllama } from './vramLock.js';

const COMFYUI_URL = process.env.COMFYUI_URL || 'http://localhost:8188';

// BullMQ queue — initialized lazily only when Redis is available
let videoQueue: Queue | null = null;

function getQueue(): Queue | null {
  if (!redisAvailable) return null;
  if (!videoQueue) {
    try {
      videoQueue = new Queue('video-gen', {
        connection: redis
      });
    } catch {
      return null;
    }
  }
  return videoQueue;
}

function buildWanWorkflow(prompt: string) {
  const safePrompt = `educational animation, smooth motion, diagram style, suitable for students, no text overlay, clean visualization: ${prompt}`;
  return {
    prompt: {
      "1": {
        "class_type": "WanVideoTextEncode",
        "inputs": {
          "positive_prompt": safePrompt,
          "negative_prompt": "realistic humans, violence, inappropriate content, blurry",
          "model_path": "wan_video/Wan2.1-T2V-1.3B"
        }
      },
      "2": {
        "class_type": "WanVideoSampler",
        "inputs": {
          "conditioning": ["1", 0],
          "steps": 25,
          "cfg": 6.0,
          "width": 832,
          "height": 480,
          "num_frames": 49,
          "seed": Math.floor(Math.random() * 999999999)
        }
      },
      "3": {
        "class_type": "WanVideoDecoder",
        "inputs": { "samples": ["2", 0] }
      },
      "4": {
        "class_type": "SaveAnimatedWEBP",
        "inputs": {
          "images": ["3", 0],
          "filename_prefix": "edugenie_video",
          "fps": 16
        }
      }
    }
  };
}

// Initialize worker lazily — only when Redis becomes available
let workerInitialized = false;
function initWorker() {
  if (workerInitialized || !redisAvailable) return;
  workerInitialized = true;

  new Worker(
    'video-gen',
    async (job) => {
      const { topic, jobId } = job.data as { topic: string; jobId: string };
      const prompt = `educational concept animation showing ${topic} process`;

      try {
        await fetch(`${COMFYUI_URL}/system_stats`, { signal: AbortSignal.timeout(3000) });
      } catch {
        await redis.set(
          `video:${jobId}`,
          JSON.stringify({ status: 'failed', reason: 'ComfyUI offline' }),
          'EX',
          3600
        );
        return;
      }

      await redis.set(`video:${jobId}`, JSON.stringify({ status: 'processing' }), 'EX', 3600);

      await withVRAM(async () => {
        await unloadOllama();
        const workflow = buildWanWorkflow(prompt);
        const res = await fetch(`${COMFYUI_URL}/prompt`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(workflow)
        });
        const { prompt_id } = (await res.json()) as { prompt_id: string };

        const start = Date.now();
        while (Date.now() - start < 1200000) {
          await new Promise(r => setTimeout(r, 5000));
          try {
            const hist = (await fetch(`${COMFYUI_URL}/history/${prompt_id}`).then(r =>
              r.json()
            )) as Record<string, {
              outputs: Record<string, { images: Array<{ filename: string; subfolder: string }> }>;
            }>;
            if (hist[prompt_id]?.outputs?.["4"]?.images?.[0]) {
              const vid = hist[prompt_id].outputs["4"].images[0];
              const url = `${COMFYUI_URL}/view?filename=${vid.filename}&subfolder=${vid.subfolder}&type=output`;
              await redis.set(`video:${jobId}`, JSON.stringify({ status: 'done', url }), 'EX', 86400);
              return;
            }
          } catch {
            /* still processing */
          }
        }
        await redis.set(
          `video:${jobId}`,
          JSON.stringify({ status: 'failed', reason: 'timeout' }),
          'EX',
          3600
        );
      });
    },
    { connection: redis }
  );
}

export async function queueVideoGen(topic: string): Promise<string> {
  initWorker();
  const jobId = `vid_${Date.now()}`;
  const queue = getQueue();
  if (queue) {
    await queue.add('generate', { topic, jobId });
    await redis.set(`video:${jobId}`, JSON.stringify({ status: 'queued' }), 'EX', 3600);
  }
  return jobId;
}

export async function getVideoStatus(jobId: string): Promise<{ status: string; url?: string; reason?: string }> {
  if (!redisAvailable) return { status: 'unavailable', reason: 'Redis not connected' };
  try {
    const val = await redis.get(`video:${jobId}`);
    return val ? JSON.parse(val) : { status: 'not_found' };
  } catch {
    return { status: 'unavailable', reason: 'Redis error' };
  }
}

export { videoQueue };
