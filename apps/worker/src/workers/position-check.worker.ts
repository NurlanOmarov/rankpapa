import { Worker, Job } from 'bullmq';
import { PrismaClient } from '@prisma/client';
import Redis from 'ioredis';
import { QUEUE_NAMES, type PositionCheckJobData } from '@rankpapa/shared';
import { proxyManager } from '../proxy/manager';
import { launchSession, newPage } from '../browser/launcher';
import { openSerp, parseSerpResults } from '../browser/serp';
import { sleep } from '../behavior/mouse';

/**
 * Position Check Worker — tracks keyword rankings in Google.kz.
 * Much lighter than PF boost: no dwell, just parse SERP and close.
 * Uses same geo/fingerprint/proxy stack for stealth.
 */

const prisma = new PrismaClient();
const connection = new Redis(process.env.REDIS_URL ?? 'redis://localhost:6379', {
  maxRetriesPerRequest: null,
});

async function processJob(job: Job<PositionCheckJobData>): Promise<void> {
  const { keywordId, keyword, targetDomain, geo } = job.data;
  const proxy = proxyManager.getProxy();
  let session = null;

  try {
    session = await launchSession({ proxy, geo, deviceType: 'DESKTOP' });
    const page = await newPage(session);

    await openSerp(page, keyword, session.geoConfig);
    await sleep(500 + Math.random() * 1000);

    const results = await parseSerpResults(page);
    const match = results.find((r) => r.url.includes(targetDomain));

    await prisma.position.create({
      data: {
        keywordId,
        position: match?.position ?? null,
        url: match?.url ?? null,
      },
    });

    job.log(`✓ "${keyword}" → pos: ${match?.position ?? 'not found'}`);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    job.log(`✗ "${keyword}" → ${message}`);
    console.error(`[POS] Job ${job.id} error for "${keyword}": ${message}`);

    if (message.includes('net::ERR') || message.includes('Timeout')) {
      proxyManager.banProxy(proxy.server);
    }

    // Still log null position on error so history is continuous
    await prisma.position.create({
      data: { keywordId, position: null, url: null },
    }).catch(() => {});
  } finally {
    if (session) await session.close();
  }
}

export function startPositionCheckWorker(): Worker {
  const worker = new Worker<PositionCheckJobData>(QUEUE_NAMES.POSITION_CHECK, processJob, {
    connection,
    concurrency: 5,
  });

  worker.on('completed', (job) => console.info(`[POS] Job ${job.id} done`));
  worker.on('failed', (job, err) => console.error(`[POS] Job ${job?.id} failed:`, err.message));

  console.info('[POS] Position check worker started');
  return worker;
}
