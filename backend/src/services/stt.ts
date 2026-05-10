export async function transcribeAudio(audioBuffer: Buffer, mimeType: string): Promise<string | null> {
  try {
    const formData = new FormData();
    formData.append('audio', new Blob([new Uint8Array(audioBuffer)], { type: mimeType }), 'audio.wav');

    const res = await fetch(`${process.env.STT_SERVICE_URL}/transcribe`, {
      method: 'POST',
      body: formData,
      signal: AbortSignal.timeout(30000)
    });
    if (!res.ok) return null;
    const data = await res.json() as { transcript: string };
    return data.transcript || null;
  } catch {
    return null;
  }
}
