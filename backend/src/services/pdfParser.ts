export async function parsePDF(pdfBuffer: Buffer): Promise<string | null> {
  try {
    const formData = new FormData();
    formData.append('file', new Blob([new Uint8Array(pdfBuffer)], { type: 'application/pdf' }), 'upload.pdf');

    const res = await fetch(`${process.env.PDF_SERVICE_URL}/parse`, {
      method: 'POST',
      body: formData,
      signal: AbortSignal.timeout(120000) // large PDFs take time
    });
    if (!res.ok) return null;
    const data = await res.json() as { markdown: string };
    return data.markdown || null;
  } catch {
    return null;
  }
}
