import type { Page } from 'playwright';
import { buildGoogleSearchUrl, type GeoConfig } from './geo';
import { humanScroll, sleep } from '../behavior/mouse';

/**
 * Google SERP interaction: search → find target → click.
 *
 * Checklist #2:  geo-correct search URL (gl + hl + uule).
 * Checklist #9:  human scroll of SERP before clicking.
 * Checklist #15: random delay distribution (no fixed timing).
 */

export interface SerpResult {
  position: number;
  url: string;
  title: string;
  element: import('playwright').ElementHandle | null;
}

/**
 * Warm up the browser session: visit Google homepage first to acquire
 * cookies and session state. This avoids hitting the JS-challenge that
 * Google shows to cookieless first-time visitors.
 */
async function warmUpSession(page: Page): Promise<void> {
  try {
    await page.goto('https://www.google.kz/', { waitUntil: 'domcontentloaded', timeout: 20000 });
    await sleep(500 + Math.random() * 1000);

    // Accept Google consent / cookie banner if shown (common in KZ/EU region)
    const acceptBtn = await page
      .locator('button:has-text("Принять"), button:has-text("Accept all"), [aria-label*="Accept"]')
      .first()
      .catch(() => null);
    if (acceptBtn) {
      await acceptBtn.click().catch(() => {});
      await sleep(300 + Math.random() * 500);
    }
  } catch {
    // Non-fatal — proceed without warm-up
  }
}

/** Navigate to Google.kz SERP and wait for results to load. */
export async function openSerp(page: Page, keyword: string, geo: GeoConfig): Promise<void> {
  // Warm up session with homepage visit before searching (avoids JS-challenge)
  await warmUpSession(page);

  const url = buildGoogleSearchUrl(keyword, geo);

  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 45000 });

  // Wait for organic results — try multiple known Google SERP selectors.
  // Google frequently renames class .g; use the most stable anchor points.
  const loaded = await page
    .waitForSelector(
      [
        // Classic layout (pre-2023)
        '.g:not(.g-blk)',
        // New layout 2023–2026: result blocks use jscontroller or data-hveid
        '[data-sokoban-container]',
        '[jscontroller][data-hveid]',
        // Absolute fallback: any h3 inside a search result link
        '#search h3',
        '#rso h3',
      ].join(', '),
      { timeout: 20000 },
    )
    .then(() => true)
    .catch(() => false);

  if (!loaded) {
    // Check if it is a CAPTCHA / JS-wall page so the caller can log it properly
    const bodyText = await page.evaluate(() => document.body?.innerText ?? '').catch(() => '');
    if (bodyText.length < 500 || bodyText.toLowerCase().includes('unusual traffic')) {
      throw new Error('SERP_BLOCKED: Google returned a CAPTCHA or JS-gate page');
    }
    // Page loaded but no known selector found — log a warning and continue;
    // parseSerpResults will return [] which is better than crashing.
  }

  // Random pause after page load (checklist #15: natural timing)
  await sleep(800 + Math.random() * 1500);
}

/**
 * SERP selectors in priority order.
 * Google redesigns its DOM regularly; we try each strategy until one yields results.
 */
const SERP_STRATEGIES: Array<{
  selector: string;
  description: string;
}> = [
  // Strategy A — classic .g wrapper (pre-2024)
  {
    selector: '.g:not(.g-blk) a[href]:not([href^="#"]):not([href*="google."])',
    description: 'classic .g wrapper',
  },
  // Strategy B — new result cards via data-hveid (2024+)
  {
    selector: '[data-hveid] a[href]:not([href^="#"]):not([href*="google."])',
    description: 'data-hveid cards',
  },
  // Strategy C — jscontroller result blocks (2025+)
  {
    selector: '[jscontroller][data-ved] a[href]:not([href^="#"]):not([href*="google."])',
    description: 'jscontroller blocks',
  },
  // Strategy D — broadest fallback: any link under #rso (organic results container)
  {
    selector: '#rso a[href]:not([href^="#"]):not([href*="google."])',
    description: '#rso fallback',
  },
];

/** Parse all organic results from the SERP page. */
export async function parseSerpResults(page: Page): Promise<SerpResult[]> {
  for (const strategy of SERP_STRATEGIES) {
    const results = await page
      .$$eval(strategy.selector, (els: Element[]) => {
        // Deduplicate by hostname — keep only the first anchor per domain.
        // Google often has multiple anchors per result card (favicon, title, breadcrumb).
        const seen = new Set<string>();
        const out: Array<{ position: number; url: string; title: string; element: null }> = [];

        for (const el of els) {
          const anchor = el as HTMLAnchorElement;
          if (!anchor.href?.startsWith('http')) continue;

          let host: string;
          try {
            host = new URL(anchor.href).hostname;
          } catch {
            continue;
          }

          if (seen.has(host)) continue;
          seen.add(host);

          // Walk up the DOM to find the nearest h3 title for this result
          const card = anchor.closest('[data-hveid], .g, [jscontroller]') ?? anchor.parentElement;
          const titleEl = card?.querySelector('h3') ?? anchor.querySelector('h3');

          out.push({
            position: out.length + 1,
            url: anchor.href,
            title: titleEl?.textContent ?? '',
            element: null,
          });
        }

        return out;
      })
      .catch(() => [] as SerpResult[]);

    if (results.length > 0) {
      return results;
    }
  }

  return [];
}

/**
 * Find the target domain in SERP results.
 * Returns position (1-based) and the clickable element.
 */
export async function findTargetInSerp(
  page: Page,
  targetDomain: string,
): Promise<{ position: number; url: string } | null> {
  const results = await parseSerpResults(page);
  const match = results.find((r) => r.url.includes(targetDomain));
  return match ? { position: match.position, url: match.url } : null;
}

/**
 * Click on a SERP result realistically:
 * - Scroll SERP to make result visible.
 * - Human mouse move + click.
 * - Handle new tab/navigation.
 */
export async function clickSerpResult(
  page: Page,
  targetDomain: string,
): Promise<{ clicked: boolean; position: number | null; newPage: Page | null }> {
  // Use all known selectors to build the anchor list, same as parseSerpResults
  const CLICK_SELECTOR = [
    '.g:not(.g-blk) a[href]:not([href^="#"]):not([href*="google."])',
    '[data-hveid] a[href]:not([href^="#"]):not([href*="google."])',
    '[jscontroller][data-ved] a[href]:not([href^="#"]):not([href*="google."])',
    '#rso a[href]:not([href^="#"]):not([href*="google."])',
  ].join(', ');

  const anchors = await page.$$(CLICK_SELECTOR);

  let targetIndex = -1;
  for (let i = 0; i < anchors.length; i++) {
    const href = await anchors[i].getAttribute('href');
    if (href && href.includes(targetDomain)) {
      targetIndex = i;
      break;
    }
  }

  if (targetIndex === -1) return { clicked: false, position: null, newPage: null };

  const anchor = anchors[targetIndex];
  const box = await anchor.boundingBox();
  if (!box) return { clicked: false, position: null, newPage: null };

  // Scroll SERP naturally before clicking (checklist #9)
  const scrollPos = box.y - 200;
  if (scrollPos > 100) {
    await humanScroll(page, { minDepth: 0.05, maxDepth: 0.2 });
    await sleep(500 + Math.random() * 1000);
  }

  // Move mouse + click
  const { humanClick } = await import('../behavior/mouse');
  await humanClick(page, box.x + box.width / 2, box.y + box.height / 2);

  // Wait for navigation (same tab) or new tab
  await sleep(1500 + Math.random() * 1000);

  return { clicked: true, position: targetIndex + 1, newPage: null };
}
