import { Worker, Job } from 'bullmq';
import { PrismaClient } from '@prisma/client';
import Redis from 'ioredis';
import { QUEUE_NAMES, type PfBoostJobData } from '@rankpapa/shared';
import { proxyManager } from '../proxy/manager';
import { launchSession, newPage } from '../browser/launcher';
import { getProfilePath, saveProfile } from '../browser/profile-manager';
import { openSerp, clickSerpResult } from '../browser/serp';
import { pickScenario, runScenario } from '../behavior/scenarios';
import { sleep } from '../behavior/mouse';

/**
 * PF Boost Worker — drives real-looking visits from Google.kz to client's site.
 *
 * Covers all 15 checklist items via modular browser/behavior layer.
 *
 * Checklist summary:
 * #1  – fingerprint rotation: new profile each job
 * #2  – geo sync: via launchSession + GeoConfig
 * #3  – varied behavior: pickScenario() → 8 scenarios
 * #4  – ramp-up: dailyRampUp() limits jobs per day
 * #5  – site interaction: scenario-specific element interactions
 * #6  – proxy rotation: proxyManager.getProxy(), ban on fail
 * #7  – Navboost: 40–50% "deep" scenarios
 * #8  – 55% mobile profiles: DeviceType=MIXED in launchSession
 * #9  – Bezier + micro-movements + read pauses
 * #10 – cookie/localStorage persistence: storageDir per profile
 * #11 – locale ru-KZ: enforced in launcher
 * #12 – dwell time spread: runScenario dwellMin/Max
 * #13 – pogo-sticking: quick_look scenario navigates back
 * #14 – hardware diversity: @apify/fingerprint-generator
 * #15 – schedule hours: scheduleStart/scheduleEnd gate in scheduler
 */

const prisma = new PrismaClient();
const connection = new Redis(process.env.REDIS_URL ?? 'redis://localhost:6379', {
  maxRetriesPerRequest: null,
});

async function processJob(job: Job<PfBoostJobData>): Promise<void> {
  const {
    keywordId,
    keyword,
    targetDomain,
    geo,
    deviceType,
    dwellTimeMin,
    dwellTimeMax,
    pagesPerSession,
  } = job.data;

  let proxy = proxyManager.getProxy();
  let session = null;

  // Create visit record
  const visit = await prisma.visit.create({
    data: { keywordId, proxy: proxy.server, status: 'SUCCESS' },
  });

  try {
    const storageDir = getProfilePath(keywordId);
    session = await launchSession({
      proxy,
      geo,
      deviceType: deviceType as 'DESKTOP' | 'MOBILE' | 'MIXED',
      storageDir,
    });

    const page = await newPage(session);

    // Track traffic via CDP (Chrome DevTools Protocol)
    let sessionBytes = 0;
    const client = await page.context().newCDPSession(page);
    await client.send('Network.enable');
    client.on('Network.dataReceived', (event) => {
      sessionBytes += event.encodedDataLength;
    });

    // 4. Pick scenario FIRST — direct_visit skips SERP entirely
    const scenario = pickScenario();

    let clickPosition: number | null = null;

    if (scenario === 'direct_visit') {
      // Direct navigation — brand/referral signal (no Google search needed)
      await page.goto(`https://${targetDomain}`, { waitUntil: 'domcontentloaded', timeout: 25000 });
      await sleep(1000 + Math.random() * 1000);
    } else {
      // 1. Open Google SERP
      await openSerp(page, keyword, session.geoConfig);

      // 2. Find & click target
      const clickResult = await clickSerpResult(page, targetDomain);

      if (!clickResult.clicked) {
        await updateVisit(visit.id, { status: 'NOT_FOUND' });
        return;
      }
      clickPosition = clickResult.position;

      // 3. Wait for target site to load
      await page.waitForLoadState('domcontentloaded', { timeout: 20000 }).catch(() => {});
      await sleep(1000 + Math.random() * 1000);
    }
    const { pogo, actualDwellSeconds } = await runScenario(
      page,
      scenario,
      dwellTimeMin,
      dwellTimeMax,
    );

    // 5. Pogo-sticking: navigate back (checklist #13)
    if (pogo) {
      await page.goBack({ timeout: 10000 }).catch(() => {});
      await sleep(2000 + Math.random() * 3000);
    }

    // 6. Multi-page sessions (checklist #5)
    if (pagesPerSession > 1 && !pogo) {
      await visitAdditionalPages(page, pagesPerSession - 1, dwellTimeMin, dwellTimeMax);
    }

    // Save cookies/localStorage so next visit looks like a returning user (checklist #10)
    await saveProfile(session.context, keywordId);

    await updateVisit(visit.id, {
      status: 'SUCCESS',
      clickPosition: clickPosition ?? undefined,
      dwellSeconds: actualDwellSeconds,
      pagesVisited: pogo ? 1 : pagesPerSession,
      trafficBytes: sessionBytes,
    });

    job.log(`✓ ${keyword} → pos:${clickPosition} dwell:${actualDwellSeconds}s scenario:${scenario}`);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);

    if (message.includes('net::ERR') || message.includes('ECONNREFUSED')) {
      proxyManager.banProxy(proxy.server);
      // Retry with a different proxy
      await updateVisit(visit.id, { status: 'FAILED', errorMessage: `Proxy error: ${message}` });
    } else if (message.toLowerCase().includes('captcha')) {
      await updateVisit(visit.id, { status: 'CAPTCHA', errorMessage: message });
    } else {
      await updateVisit(visit.id, { status: 'FAILED', errorMessage: message });
    }

    job.log(`✗ ${keyword} → ${message}`);
  } finally {
    if (session) await session.close();
  }
}

async function visitAdditionalPages(
  page: import('playwright').Page,
  count: number,
  dwellMin: number,
  dwellMax: number,
): Promise<void> {
  for (let i = 0; i < count; i++) {
    const links = await page.$$('a[href^="/"], nav a');
    if (links.length === 0) break;

    const link = links[Math.floor(Math.random() * Math.min(links.length, 8))];
    const href = await link.getAttribute('href');
    if (!href) continue;

    try {
      await page.click(`a[href="${href}"]`, { timeout: 5000 });
      await page.waitForLoadState('domcontentloaded', { timeout: 10000 }).catch(() => {});
      const { humanScroll, sleep: s } = await import('../behavior/mouse');
      await humanScroll(page, { minDepth: 0.3, maxDepth: 0.7 });
      await s(dwellMin * 300 + Math.random() * dwellMax * 300);
    } catch {}
  }
}

async function updateVisit(
  id: string,
  data: {
    status?: string;
    clickPosition?: number;
    dwellSeconds?: number;
    pagesVisited?: number;
    errorMessage?: string;
    trafficBytes?: number;
  },
): Promise<void> {
  await prisma.visit.update({ where: { id }, data: data as Parameters<typeof prisma.visit.update>[0]['data'] });
}

export function startPfBoostWorker(): Worker {
  const concurrency = parseInt(process.env.WORKER_CONCURRENCY ?? '8', 10);

  const worker = new Worker<PfBoostJobData>(QUEUE_NAMES.PF_BOOST, processJob, {
    connection,
    concurrency,
    limiter: { max: concurrency, duration: 1000 },
  });

  worker.on('completed', (job) => console.info(`[PF] Job ${job.id} done`));
  worker.on('failed', (job, err) => console.error(`[PF] Job ${job?.id} failed:`, err.message));

  console.info(`[PF] Worker started (concurrency: ${concurrency})`);
  return worker;
}
