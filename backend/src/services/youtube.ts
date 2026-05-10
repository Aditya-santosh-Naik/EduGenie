export async function searchYouTube(query: string): Promise<{ videoId: string; title: string } | null> {
  const apiKey = process.env.YOUTUBE_API_KEY;
  if (!apiKey || apiKey === 'your_youtube_api_key_here') {
    console.warn('[youtube] No API key configured — skipping YouTube search');
    return null;
  }

  try {
    const url = new URL('https://www.googleapis.com/youtube/v3/search');
    url.searchParams.set('part', 'snippet');
    url.searchParams.set('q', `${query} educational explained`);
    url.searchParams.set('type', 'video');
    url.searchParams.set('safeSearch', 'strict');
    url.searchParams.set('maxResults', '1');
    url.searchParams.set('key', apiKey);

    const res = await fetch(url.toString(), { signal: AbortSignal.timeout(10000) });
    const data = await res.json() as {
      items?: Array<{
        id: { videoId: string };
        snippet: { title: string };
      }>;
    };
    const item = data.items?.[0];
    if (!item) return null;

    return {
      videoId: item.id.videoId,
      title: item.snippet.title
    };
  } catch {
    return null;
  }
}
