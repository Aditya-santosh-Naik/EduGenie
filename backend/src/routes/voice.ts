import { Hono } from 'hono';
import { synthesizeSpeech } from '../services/tts.js';
import { transcribeAudio } from '../services/stt.js';

const voice = new Hono();

voice.post('/tts', async (c) => {
  const { text, voice: voiceName = 'af_heart' } = await c.req.json();
  if (!text) return c.json({ error: 'text required' }, 400);

  const audio = await synthesizeSpeech(text, voiceName);
  if (!audio) {
    return c.json({ error: 'TTS service unavailable — use browser TTS fallback' }, 503);
  }

  return new Response(new Uint8Array(audio), {
    headers: {
      'Content-Type': 'audio/wav',
      'Content-Length': audio.length.toString()
    }
  });
});

voice.post('/stt', async (c) => {
  const formData = await c.req.formData();
  const audio = formData.get('audio') as File;
  if (!audio) return c.json({ error: 'audio file required' }, 400);

  const buffer = Buffer.from(await audio.arrayBuffer());
  const transcript = await transcribeAudio(buffer, audio.type);

  if (!transcript) {
    return c.json({ error: 'Transcription failed — make sure STT service is running' }, 503);
  }

  return c.json({ transcript });
});

export { voice };
