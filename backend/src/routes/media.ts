import { Hono } from 'hono';
import { queueVideoGen, getVideoStatus } from '../services/videoGen.js';

const media = new Hono();

// Queue a video generation job — returns immediately with jobId (NEVER blocks HTTP response)
media.post('/video/generate', async (c) => {
  const { topic } = await c.req.json();
  if (!topic) return c.json({ error: 'topic required' }, 400);

  const jobId = await queueVideoGen(topic);
  return c.json({
    jobId,
    status: 'queued',
    message: 'Video generation started. Poll /video/status/:jobId for updates.'
  });
});

// Poll video job status
media.get('/video/status/:jobId', async (c) => {
  const jobId = c.req.param('jobId');
  const status = await getVideoStatus(jobId);
  return c.json(status);
});

export { media };
