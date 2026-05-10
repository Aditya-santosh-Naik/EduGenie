export async function synthesizeSpeech(text: string, voice = 'af_heart'): Promise<Buffer | null> {
  try {
    const res = await fetch(`${process.env.TTS_SERVICE_URL}/tts`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text, voice, speed: 1.0 }),
      signal: AbortSignal.timeout(60000)
    });
    if (!res.ok) return null;
    return Buffer.from(await res.arrayBuffer());
  } catch {
    // TTS unavailable — frontend falls back to browser TTS
    return null;
  }
}
