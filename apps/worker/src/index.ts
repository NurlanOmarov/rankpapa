import 'dotenv/config';
import Redis from 'ioredis';
import { proxyManager } from './proxy/manager';
import { startPfBoostWorker } from './workers/pf-boost.worker';
import { startPositionCheckWorker } from './workers/position-check.worker';
import { Scheduler } from './utils/scheduler';

async function bootstrap() {
  console.info('[Worker] Starting RankPapa worker...');

  // Load proxy pool from PROSOX
  await proxyManager.loadProxies(
    parseInt(process.env.PROSOX_PORT_COUNT ?? '50', 10),
  );

  // Start BullMQ workers
  const pfWorker = startPfBoostWorker();
  const posWorker = startPositionCheckWorker();

  // Start scheduler (dispatches jobs every minute)
  const redis = new Redis(process.env.REDIS_URL ?? 'redis://localhost:6379', {
    maxRetriesPerRequest: null,
  });
  const scheduler = new Scheduler(redis);
  scheduler.start();

  console.info('[Worker] All systems running');

  // Graceful shutdown
  process.on('SIGTERM', async () => {
    console.info('[Worker] SIGTERM received, shutting down...');
    scheduler.stop();
    await pfWorker.close();
    await posWorker.close();
    await redis.quit();
    process.exit(0);
  });
}

bootstrap().catch((err) => {
  console.error('[Worker] Fatal error:', err);
  process.exit(1);
});
