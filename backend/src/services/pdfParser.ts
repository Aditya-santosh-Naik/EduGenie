export interface ParsedPDF {
  markdown: string;
  pages: number;
  engine: string;
}

export async function parsePDF(pdfBuffer: Buffer): Promise<ParsedPDF | null> {
  try {
    const formData = new FormData();
    formData.append(
      'file',
      new Blob([new Uint8Array(pdfBuffer)], { type: 'application/pdf' }),
      'upload.pdf'
    );

    const res = await fetch(`${process.env.PDF_SERVICE_URL}/parse`, {
      method: 'POST',
      body: formData,
      signal: AbortSignal.timeout(120000) // large PDFs take time
    });

    if (!res.ok) {
      const detail = await res.text().catch(() => '');
      console.warn(`[pdf] parser returned ${res.status}: ${detail.slice(0, 200)}`);
      return null;
    }

    const data = (await res.json()) as { markdown?: string; pages?: number; engine?: string };
    if (!data.markdown) return null;

    return {
      markdown: data.markdown,
      pages: data.pages ?? 0,
      engine: data.engine ?? 'unknown'
    };
  } catch (err) {
    console.warn(`[pdf] parser unreachable at ${process.env.PDF_SERVICE_URL}:`, err);
    return null;
  }
}
