import 'dotenv/config';
import Redis from 'ioredis';
import { proxyManager } from './proxy/manager';
import { startPfBoostWorker } from './workers/pf-boost.worker';
import { startPositionCheckWorker } from './workers/position-check.worker';
import { Scheduler } from './utils/scheduler';

const PROXY_RELOAD_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes

async function bootstrap() {
  console.info('[Worker] Starting RankPapa worker...');

  // Load proxy pool from PROSOX (non-fatal: worker continues with empty pool)
  await proxyManager.loadProxies(
    parseInt(process.env.PROSOX_PORT_COUNT ?? '50', 10),
  );

  // Auto-reload proxies every 5 minutes so we recover when PROSOX API comes back
  const proxyReloadTimer = setInterval(async () => {
    if (proxyManager.size === 0) {
      console.info('[Worker] Proxy pool empty — attempting reload...');
      await proxyManager.loadProxies(
        parseInt(process.env.PROSOX_PORT_COUNT ?? '50', 10),
      );
    }
  }, PROXY_RELOAD_INTERVAL_MS);

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
    clearInterval(proxyReloadTimer);
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
