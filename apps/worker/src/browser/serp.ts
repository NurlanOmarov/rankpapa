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

/** Navigate to Google.kz SERP and wait for results to load. */
export async function openSerp(page: Page, keyword: string, geo: GeoConfig): Promise<void> {
  const url = buildGoogleSearchUrl(keyword, geo);

  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });

  // Wait for organic results
  await page.waitForSelector('.g, [data-sokoban-container]', { timeout: 15000 }).catch(() => {});

  // Random pause after page load (checklist #15: natural timing)
  await sleep(800 + Math.random() * 1500);
}

/** Parse all organic results from the SERP page. */
export async function parseSerpResults(page: Page): Promise<SerpResult[]> {
  const results = await page.$$eval(
    '.g:not(.g-blk) a[href]:not([href^="#"]):not([href*="google"])',
    (els: Element[]) =>
      els
        .map((el: Element, idx: number) => {
          const anchor = el as HTMLAnchorElement;
          const titleEl = anchor.querySelector('h3');
          return {
            position: idx + 1,
            url: anchor.href,
            title: titleEl?.textContent ?? '',
            element: null,
          };
        })
        .filter((r) => r.url.startsWith('http')),
  );
  return results;
}

/**
 * Find the target domain in SERP results.
 * Returns position (1-based) and the clickable element.
 */
export async function findTargetInSerp(
  page: Page,
  targetDomain: string,
): Promise<{ position: number; url: string } | null> {
  const anchors = await page.$$('.g a[href]:not([href^="#"])');

  for (let i = 0; i < anchors.length; i++) {
    const href = await anchors[i].getAttribute('href');
    if (href && href.includes(targetDomain)) {
      return { position: i + 1, url: href };
    }
  }
  return null;
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
  const anchors = await page.$$('.g a[href]:not([href^="#"])');

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
