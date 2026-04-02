/**
 * Serper.dev API client for Google SERP position checking.
 * Replaces Playwright-based SERP scraping for position tracking.
 * Serper.dev handles proxies, CAPTCHAs, and bot detection internally.
 *
 * Docs: https://serper.dev/api-reference
 */

export interface SerperResult {
  position: number;
  title: string;
  link: string;
  snippet?: string;
}

export interface SerperResponse {
  organic: SerperResult[];
  searchInformation?: { totalResults: string; timeTaken: number };
}

export async function searchSerper(
  keyword: string,
  gl = 'kz',
  hl = 'ru',
  num = 100,
): Promise<SerperResult[]> {
  const apiKey = process.env.SERPER_API_KEY;
  if (!apiKey) throw new Error('SERPER_API_KEY is not set');

  const response = await fetch('https://google.serper.dev/search', {
    method: 'POST',
    headers: {
      'X-API-KEY': apiKey,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ q: keyword, gl, hl, num }),
    signal: AbortSignal.timeout(15000),
  });

  if (!response.ok) {
    const text = await response.text().catch(() => '');
    throw new Error(`Serper API error ${response.status}: ${text.substring(0, 200)}`);
  }

  const data = (await response.json()) as SerperResponse;
  return data.organic ?? [];
}

/**
 * Find the position of a domain in Serper.dev results.
 * Returns position (1-based) and matched URL, or null if not found in top-100.
 */
export async function checkPositionSerper(
  keyword: string,
  targetDomain: string,
  geo = 'ALMATY',
): Promise<{ position: number; url: string } | null> {
  // Map geo city to Google country code
  const gl = 'kz';
  const hl = 'ru';

  const results = await searchSerper(keyword, gl, hl, 100);

  const match = results.find((r) => {
    try {
      const hostname = new URL(r.link).hostname.replace(/^www\./, '');
      const domain = targetDomain.replace(/^www\./, '');
      return hostname === domain || hostname.endsWith(`.${domain}`);
    } catch {
      return false;
    }
  });

  if (!match) return null;
  return { position: match.position, url: match.link };
}
