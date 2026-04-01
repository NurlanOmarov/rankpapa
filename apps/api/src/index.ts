import 'dotenv/config';
import Fastify from 'fastify';
import cors from '@fastify/cors';
import jwt from '@fastify/jwt';
import { prismaPlugin } from './plugins/prisma';
import { redisPlugin } from './plugins/redis';
import { authRoutes } from './routes/auth';
import { sitesRoutes } from './routes/sites';
import { campaignsRoutes } from './routes/campaigns';
import { statsRoutes } from './routes/stats';
import { billingRoutes } from './routes/billing';
import { adminRoutes } from './routes/admin';
import { notificationRoutes } from './routes/notifications';

const app = Fastify({ logger: { level: 'info' } });

async function bootstrap() {
  await app.register(cors, { origin: true });
  await app.register(jwt, { secret: process.env.JWT_SECRET ?? 'dev-secret' });
  await app.register(prismaPlugin);
  await app.register(redisPlugin);

  app.get('/health', async () => ({ status: 'ok', ts: new Date().toISOString() }));

  await app.register(authRoutes, { prefix: '/api/auth' });
  await app.register(sitesRoutes, { prefix: '/api/sites' });
  await app.register(campaignsRoutes, { prefix: '/api/campaigns' });
  await app.register(billingRoutes, { prefix: '/api/billing' });
  await app.register(statsRoutes, { prefix: '/api/stats' });
  await app.register(adminRoutes, { prefix: '/api/admin' });
  await app.register(notificationRoutes, { prefix: '/api/notifications' });

  const host = process.env.API_HOST ?? '0.0.0.0';
  const port = parseInt(process.env.API_PORT ?? '3000', 10);
  await app.listen({ host, port });
  app.log.info(`RankPapa API running on ${host}:${port}`);
}

bootstrap().catch((err) => {
  console.error(err);
  process.exit(1);
});
