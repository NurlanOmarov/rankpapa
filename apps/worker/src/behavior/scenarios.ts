import type { Page } from 'playwright';
import { humanScroll, humanClick, sleep, randInt } from './mouse';

/**
 * Behavioral scenarios for post-click on-site behavior.
 *
 * Checklist #3:  8–12 different scenarios, random pauses, varied scroll.
 * Checklist #5:  Simulate real interactions (calculator, form, reviews, portfolio).
 * Checklist #7:  40–50% "studying" visits (Navboost good clicks).
 * Checklist #9:  Pauses when reading prices, micro-movements.
 * Checklist #12: dwell time spread 60–300 sec (avg 120–180 for transfers).
 * Checklist #13: 15–25% visits return to Google (pogo-sticking).
 */

export type ScenarioType =
  | 'quick_look'       // short visit, may pogo-stick (bad click signal — 15–25% of visits)
  | 'scroll_read'      // scroll + read, medium dwell
  | 'deep_explore'     // scroll + click internal links + read
  | 'calculator'       // interact with calculator/form element
  | 'check_prices'     // focus on pricing section
  | 'read_reviews'     // scroll to reviews, hover over them
  | 'portfolio_look'   // browse gallery/portfolio/car fleet
  | 'contact_intent'   // scroll to contacts, hover over phone/WhatsApp
  | 'direct_visit';    // direct navigation (research #20: brand signal, 20–30% of traffic)

/**
 * Pick a scenario weighted by the checklist + research recommendations.
 *
 * Research #20: 20–30% direct visits (brand signal).
 * Checklist #7:  40–50% "studying" scenarios (Navboost good clicks).
 * Checklist #13: 15–20% quick/pogo-stick.
 */
export function pickScenario(): ScenarioType {
  const roll = Math.random();
  // 20–25% direct visits — brand signal (research #20)
  if (roll < 0.22) return 'direct_visit';
  // 15–18% quick/pogo-stick (bad clicks — natural mix)
  if (roll < 0.38) return 'quick_look';
  // 40–50% "studying" scenarios (Navboost good clicks)
  if (roll < 0.52) return 'scroll_read';
  if (roll < 0.64) return 'check_prices';
  if (roll < 0.74) return 'read_reviews';
  if (roll < 0.82) return 'portfolio_look';
  if (roll < 0.90) return 'deep_explore';
  if (roll < 0.95) return 'calculator';
  return 'contact_intent';
}

/** Returns the dwell time in ms for a given scenario (checklist #12) */
function dwellMs(min = 60, max = 300): number {
  // Normal-ish distribution around 120–180 sec
  const base = (min + max) / 2;
  const spread = (max - min) / 4;
  const raw = base + (Math.random() - 0.5) * 2 * spread * 1.5;
  return Math.max(min, Math.min(max, Math.round(raw))) * 1000;
}

// ─── Scenario implementations ────────────────────────────────────────────────

export async function runScenario(
  page: Page,
  scenario: ScenarioType,
  dwellMin: number,
  dwellMax: number,
): Promise<{ pogo: boolean; actualDwellSeconds: number }> {
  const start = Date.now();
  let pogo = false;

  switch (scenario) {
    case 'quick_look':
      pogo = await scenarioQuickLook(page, dwellMin, dwellMax);
      break;
    case 'scroll_read':
      await scenarioScrollRead(page, dwellMin, dwellMax);
      break;
    case 'deep_explore':
      await scenarioDeepExplore(page, dwellMin, dwellMax);
      break;
    case 'calculator':
      await scenarioCalculator(page, dwellMin, dwellMax);
      break;
    case 'check_prices':
      await scenarioCheckPrices(page, dwellMin, dwellMax);
      break;
    case 'read_reviews':
      await scenarioReadReviews(page, dwellMin, dwellMax);
      break;
    case 'portfolio_look':
      await scenarioPortfolio(page, dwellMin, dwellMax);
      break;
    case 'contact_intent':
      await scenarioContactIntent(page, dwellMin, dwellMax);
      break;
    case 'direct_visit':
      await scenarioScrollRead(page, dwellMin, dwellMax); // same behavior, different entry (no SERP)
      break;
  }

  const actualDwellSeconds = Math.round((Date.now() - start) / 1000);
  return { pogo, actualDwellSeconds };
}

// ─── Individual scenarios ─────────────────────────────────────────────────────

/** 15–25% of visits. Short stay, then returns to Google. */
async function scenarioQuickLook(page: Page, dwellMin: number, dwellMax: number): Promise<boolean> {
  // Short scroll — only top of page
  await humanScroll(page, { minDepth: 0.1, maxDepth: 0.3 });
  await sleep(dwellMs(Math.min(dwellMin, 30), Math.min(dwellMax, 60)));
  // Pogo-stick: navigate back to SERP
  return true;
}

/** Simple scroll + read, medium dwell. */
async function scenarioScrollRead(page: Page, dwellMin: number, dwellMax: number): Promise<void> {
  await humanScroll(page, { minDepth: 0.4, maxDepth: 0.7 });
  await sleep(dwellMs(dwellMin, dwellMax));
}

/** Deep: scroll + click on internal link + read second page. */
async function scenarioDeepExplore(page: Page, dwellMin: number, dwellMax: number): Promise<void> {
  await humanScroll(page, { minDepth: 0.5, maxDepth: 0.8 });
  await sleep(randInt(1000, 3000));

  // Try to click an internal link (nav or content link)
  const internalLinks = await page.$$('a[href^="/"], a[href*="' + page.url().split('/')[2] + '"]');
  if (internalLinks.length > 1) {
    const link = internalLinks[randInt(1, Math.min(internalLinks.length - 1, 5))];
    const box = await link.boundingBox();
    if (box) {
      await humanClick(page, box.x + box.width / 2, box.y + box.height / 2);
      await sleep(randInt(500, 1500));
      await humanScroll(page, { minDepth: 0.3, maxDepth: 0.7 });
    }
  }
  await sleep(dwellMs(dwellMin, dwellMax));
}

/** Interact with a calculator / form element (checklist #5). */
async function scenarioCalculator(page: Page, dwellMin: number, dwellMax: number): Promise<void> {
  await humanScroll(page, { minDepth: 0.2, maxDepth: 0.5 });
  await sleep(randInt(800, 2000));

  // Try to find select/input elements (booking form, calculator)
  const selects = await page.$$('select, input[type="text"], input[type="tel"]');
  if (selects.length > 0) {
    for (const el of selects.slice(0, randInt(1, 3))) {
      const box = await el.boundingBox();
      if (box) {
        await humanClick(page, box.x + box.width / 2, box.y + box.height / 2);
        await sleep(randInt(400, 1200));
      }
    }
  }

  await humanScroll(page, { minDepth: 0.4, maxDepth: 0.75 });
  await sleep(dwellMs(dwellMin, dwellMax));
}

/** Focus on pricing section (checklist #7: Navboost good clicks). */
async function scenarioCheckPrices(page: Page, dwellMin: number, dwellMax: number): Promise<void> {
  // Scroll to price-related section
  await humanScroll(page, { minDepth: 0.3, maxDepth: 0.6 });
  await sleep(randInt(2000, 5000)); // reading prices

  // Hover over a price element if visible
  const priceEl = await page.$('[class*="price"], [class*="tariff"], [class*="cost"], [class*="тариф"]');
  if (priceEl) {
    const box = await priceEl.boundingBox();
    if (box) await humanClick(page, box.x + box.width / 2, box.y + box.height / 2);
  }

  await sleep(dwellMs(dwellMin, dwellMax));
}

/** Scroll to reviews section, hover and read (checklist #5). */
async function scenarioReadReviews(page: Page, dwellMin: number, dwellMax: number): Promise<void> {
  await humanScroll(page, { minDepth: 0.6, maxDepth: 0.9 });
  await sleep(randInt(3000, 7000)); // reading reviews
  await humanScroll(page, { minDepth: 0.7, maxDepth: 1.0 });
  await sleep(dwellMs(dwellMin, dwellMax));
}

/** Browse photo gallery / car fleet / portfolio (checklist #5, transfer-astana.com). */
async function scenarioPortfolio(page: Page, dwellMin: number, dwellMax: number): Promise<void> {
  await humanScroll(page, { minDepth: 0.4, maxDepth: 0.85 });
  await sleep(randInt(1000, 2500));

  // Click gallery items if present
  const galleryItems = await page.$$('[class*="gallery"], [class*="photo"], [class*="car"], [class*="fleet"] img');
  if (galleryItems.length > 0) {
    const item = galleryItems[randInt(0, Math.min(galleryItems.length - 1, 4))];
    const box = await item.boundingBox();
    if (box) {
      await humanClick(page, box.x + box.width / 2, box.y + box.height / 2);
      await sleep(randInt(1000, 3000));
    }
  }

  await sleep(dwellMs(dwellMin, dwellMax));
}

/** Scroll to contacts, hover over phone/WhatsApp (checklist #9, real user intent). */
async function scenarioContactIntent(page: Page, dwellMin: number, dwellMax: number): Promise<void> {
  await humanScroll(page, { minDepth: 0.5, maxDepth: 0.95 });
  await sleep(randInt(1500, 4000));

  // Hover over phone/WhatsApp link
  const contactEl = await page.$('a[href^="tel:"], a[href*="whatsapp"], a[href*="wa.me"]');
  if (contactEl) {
    const box = await contactEl.boundingBox();
    if (box) {
      // Move mouse to it (intent signal) but don't actually click (no conversion)
      const { moveMouse } = await import('./mouse');
      await moveMouse(page, box.x + box.width / 2, box.y + box.height / 2);
      await sleep(randInt(800, 2000));
    }
  }

  await sleep(dwellMs(dwellMin, dwellMax));
}
