import { Worker, Job } from 'bullmq';
import { PrismaClient } from '@prisma/client';
import Redis from 'ioredis';
import { QUEUE_NAMES, type PositionCheckJobData } from '@rankpapa/shared';
import { checkPositionSerper } from '../browser/serper';

/**
 * Position Check Worker — tracks keyword rankings in Google.kz via Serper.dev API.
 * No browser/proxy needed: Serper.dev handles all anti-bot measures internally.
 */

const prisma = new PrismaClient();
const connection = new Redis(process.env.REDIS_URL ?? 'redis://localhost:6379', {
  maxRetriesPerRequest: null,
});

async function processJob(job: Job<PositionCheckJobData>): Promise<void> {
  const { keywordId, keyword, targetDomain, geo } = job.data;

  try {
    const match = await checkPositionSerper(keyword, targetDomain, geo);

    await prisma.position.create({
      data: {
        keywordId,
        position: match?.position ?? null,
        url: match?.url ?? null,
      },
    });

    job.log(`✓ "${keyword}" → pos: ${match?.position ?? 'not found'}`);
    console.info(`[POS] "${keyword}" → ${match ? `#${match.position} ${match.url}` : 'not found'}`);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    job.log(`✗ "${keyword}" → ${message}`);
    console.error(`[POS] Job ${job.id} error for "${keyword}": ${message}`);

    // Still log null position on error so history is continuous
    await prisma.position.create({
      data: { keywordId, position: null, url: null },
    }).catch(() => {});
  }
}

export function startPositionCheckWorker(): Worker {
  const worker = new Worker<PositionCheckJobData>(QUEUE_NAMES.POSITION_CHECK, processJob, {
    connection,
    concurrency: 5,
  });

  worker.on('completed', (job) => console.info(`[POS] Job ${job.id} done`));
  worker.on('failed', (job, err) => console.error(`[POS] Job ${job?.id} failed:`, err.message));

  console.info('[POS] Position check worker started (Serper.dev)');
  return worker;
}
