import type { Page } from 'playwright';

/**
 * Human-like mouse movement using Bezier curves.
 * Checklist #3, #9: avoid straight-line movement, add micro-movements and pauses.
 */

interface Point { x: number; y: number }

function bezier(t: number, p0: Point, p1: Point, p2: Point, p3: Point): Point {
  const mt = 1 - t;
  return {
    x: mt ** 3 * p0.x + 3 * mt ** 2 * t * p1.x + 3 * mt * t ** 2 * p2.x + t ** 3 * p3.x,
    y: mt ** 3 * p0.y + 3 * mt ** 2 * t * p1.y + 3 * mt * t ** 2 * p2.y + t ** 3 * p3.y,
  };
}

function rand(min: number, max: number): number {
  return Math.random() * (max - min) + min;
}

/**
 * Move mouse from current position to target using a cubic Bezier curve.
 * Speed and jitter vary randomly to avoid pattern detection.
 */
export async function moveMouse(page: Page, toX: number, toY: number): Promise<void> {
  const mouse = page.mouse;
  const viewport = page.viewportSize() ?? { width: 1280, height: 720 };

  // Get rough current position from viewport center (we don't track it precisely)
  const fromX = rand(viewport.width * 0.1, viewport.width * 0.9);
  const fromY = rand(viewport.height * 0.1, viewport.height * 0.9);

  // Control points with randomness
  const cp1: Point = {
    x: fromX + rand(-200, 200),
    y: fromY + rand(-150, 150),
  };
  const cp2: Point = {
    x: toX + rand(-200, 200),
    y: toY + rand(-150, 150),
  };

  const steps = Math.floor(rand(20, 45));
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const pos = bezier(t, { x: fromX, y: fromY }, cp1, cp2, { x: toX, y: toY });

    // Add micro-jitter (checklist #9)
    const jx = rand(-1.5, 1.5);
    const jy = rand(-1.5, 1.5);
    await mouse.move(pos.x + jx, pos.y + jy);

    // Variable speed: slow at start/end, fast in middle
    const speedFactor = Math.sin(Math.PI * t);
    await sleep(rand(5, 20) / (speedFactor + 0.1));
  }

  // Micro-movements after arriving (checklist #9: human "settling")
  for (let i = 0; i < 3; i++) {
    await mouse.move(toX + rand(-3, 3), toY + rand(-3, 3));
    await sleep(rand(30, 80));
  }
}

/**
 * Click with human timing: move → hover pause → click → post-click pause.
 *
 * Research #17: clicks must NOT be pixel-perfect center.
 * Use Gaussian distribution around element center (σ = 25–40% of element size).
 */
export async function humanClick(page: Page, x: number, y: number, elementWidth = 0, elementHeight = 0): Promise<void> {
  // Gaussian offset from center (research: human clicks distributed across element area)
  const sigmaX = elementWidth > 0 ? elementWidth * 0.28 : 8;
  const sigmaY = elementHeight > 0 ? elementHeight * 0.28 : 6;
  const offsetX = gaussianRand(0, sigmaX);
  const offsetY = gaussianRand(0, sigmaY);

  const targetX = x + offsetX;
  const targetY = y + offsetY;

  await moveMouse(page, targetX, targetY);
  await sleep(rand(80, 250)); // hover pause
  await page.mouse.click(targetX, targetY, { delay: rand(50, 150) });
  await sleep(rand(100, 400)); // post-click
}

/**
 * Box-Muller transform for Gaussian random number.
 */
function gaussianRand(mean: number, sigma: number): number {
  const u1 = Math.random();
  const u2 = Math.random();
  const z = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
  return Math.max(-sigma * 2, Math.min(sigma * 2, mean + z * sigma)); // clamp to ±2σ
}

/**
 * Human-like scroll with cognitive load simulation.
 *
 * Research #18: scroll speed varies by content type.
 * - Text paragraphs → slow (high cognitive load)
 * - Images, hero sections → fast
 * - Lists, prices → medium with stop-and-read
 *
 * Checklist #3: varied scroll depth; checklist #9: pauses while "reading".
 */
export async function humanScroll(
  page: Page,
  opts: { minDepth?: number; maxDepth?: number } = {},
): Promise<void> {
  const { minDepth = 0.3, maxDepth = 0.85 } = opts;
  const totalHeight = await page.evaluate(() => document.body.scrollHeight);
  const targetScroll = totalHeight * rand(minDepth, maxDepth);

  // Detect rough content zones (text-heavy vs image-heavy) via DOM analysis
  const contentZones = await page.evaluate(() => {
    const zones: Array<{ top: number; type: 'text' | 'image' | 'list' | 'price' }> = [];
    const sections = document.querySelectorAll('section, [class*="hero"], [class*="about"], [class*="price"], [class*="review"], ul, ol');
    sections.forEach((el) => {
      const rect = el.getBoundingClientRect();
      const absTop = rect.top + window.scrollY;
      const text = el.textContent ?? '';
      const hasImages = el.querySelectorAll('img').length > 0;
      const type = hasImages ? 'image'
        : el.tagName === 'UL' || el.tagName === 'OL' ? 'list'
        : text.includes('₸') || text.toLowerCase().includes('цен') ? 'price'
        : 'text';
      zones.push({ top: absTop, type });
    });
    return zones;
  });

  let scrolled = 0;
  while (scrolled < targetScroll) {
    // Find which zone we're in
    const currentZone = contentZones.findLast?.((z: any) => z.top <= scrolled) ?? null;
    const zoneType = currentZone?.type ?? 'text';

    // Cognitive load: text = small chunks + long pauses, images = big chunks + short pauses
    let chunkSize: number;
    let pauseMs: number;
    let readProbability: number;

    switch (zoneType) {
      case 'image':
        chunkSize = rand(400, 800); // fast scroll through images
        pauseMs = rand(80, 250);
        readProbability = 0.1;
        break;
      case 'price':
        chunkSize = rand(80, 200); // slow — reading prices
        pauseMs = rand(1500, 4000);
        readProbability = 0.7;
        break;
      case 'list':
        chunkSize = rand(150, 350);
        pauseMs = rand(400, 1200);
        readProbability = 0.4;
        break;
      default: // text
        chunkSize = rand(100, 300); // slow — reading paragraphs
        pauseMs = rand(600, 2500);
        readProbability = 0.45;
    }

    await page.mouse.wheel(0, chunkSize);
    scrolled += chunkSize;

    if (Math.random() < readProbability) {
      await sleep(pauseMs);
    } else {
      await sleep(rand(80, 300));
    }
  }

  // Scroll back up a bit (natural reading behaviour)
  if (Math.random() < 0.4) {
    await page.mouse.wheel(0, -rand(200, 600));
    await sleep(rand(500, 1500));
  }
}

export function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

export function randInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}
