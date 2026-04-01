import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { Queue } from 'bullmq';
import { requireAuth } from '../middleware/auth';
import { QUEUE_NAMES, PfBoostJobData, PositionCheckJobData } from '@rankpapa/shared';

const CreateCampaignSchema = z.object({
  siteId: z.string(),
  type: z.enum(['PF_BOOST', 'POSITION_TRACKING']),
  dailyVisitLimit: z.number().int().min(10).max(2000).default(100),
  dwellTimeMin: z.number().int().min(30).max(600).default(60),
  dwellTimeMax: z.number().int().min(60).max(600).default(180),
  pagesPerSession: z.number().int().min(1).max(10).default(2),
  rampUpDays: z.number().int().min(1).max(30).default(7),
  scheduleStart: z.number().int().min(0).max(23).default(9),
  scheduleEnd: z.number().int().min(0).max(23).default(22),
  keywords: z.array(z.object({ keyword: z.string().min(1), targetUrl: z.string().optional() })).min(1),
});

export async function campaignsRoutes(app: FastifyInstance) {
  app.addHook('preHandler', requireAuth);

  const pfQueue = new Queue<PfBoostJobData>(QUEUE_NAMES.PF_BOOST, {
    connection: app.redis,
  });
  const posQueue = new Queue<PositionCheckJobData>(QUEUE_NAMES.POSITION_CHECK, {
    connection: app.redis,
  });

  app.get('/', async (req) => {
    return app.prisma.campaign.findMany({
      where: { site: { userId: req.user.userId } },
      include: { keywords: true, site: true },
      orderBy: { createdAt: 'desc' },
    });
  });

  app.get('/:id', async (req, reply) => {
    const { id } = req.params as { id: string };
    const campaign = await app.prisma.campaign.findFirst({
      where: { id, site: { userId: req.user.userId } },
      include: {
        keywords: {
          include: {
            visits: { orderBy: { createdAt: 'desc' }, take: 10 },
            positions: { orderBy: { checkedAt: 'desc' }, take: 1 },
          },
        },
        site: true,
      },
    });
    if (!campaign) return reply.status(404).send({ error: 'Not found' });
    return campaign;
  });

  app.get('/:id/queue-status', async (req, reply) => {
    const { id } = req.params as { id: string };
    const campaign = await app.prisma.campaign.findFirst({
      where: { id, site: { userId: req.user.userId } },
      select: { type: true, keywords: { select: { id: true } } },
    });
    if (!campaign) return reply.status(404).send({ error: 'Not found' });

    const queue = campaign.type === 'PF_BOOST' ? pfQueue : posQueue;
    const [waiting, active, completed, failed] = await Promise.all([
      queue.getWaitingCount(),
      queue.getActiveCount(),
      queue.getCompletedCount(),
      queue.getFailedCount(),
    ]);
    return { waiting, active, completed, failed, total: campaign.keywords.length };
  });

  app.post('/', async (req, reply) => {
    const body = CreateCampaignSchema.safeParse(req.body);
    if (!body.success) return reply.status(400).send({ error: body.error.flatten() });

    const site = await app.prisma.site.findFirst({
      where: { id: body.data.siteId, userId: req.user.userId },
    });
    if (!site) return reply.status(404).send({ error: 'Site not found' });

    const { keywords, ...campaignData } = body.data;
    const campaign = await app.prisma.campaign.create({
      data: {
        ...campaignData,
        keywords: { create: keywords },
      },
      include: { keywords: true },
    });

    // Enqueue initial jobs
    if (campaign.type === 'PF_BOOST') {
      for (const kw of campaign.keywords) {
        await pfQueue.add('visit', {
          visitId: '', // will be created by worker
          keywordId: kw.id,
          keyword: kw.keyword,
          targetDomain: site.domain,
          geo: site.geo,
          deviceType: site.deviceType,
          dwellTimeMin: campaign.dwellTimeMin,
          dwellTimeMax: campaign.dwellTimeMax,
          pagesPerSession: campaign.pagesPerSession,
        }, { repeat: { every: Math.floor(86400000 / campaign.dailyVisitLimit) } });
      }
    } else {
      for (const kw of campaign.keywords) {
        await posQueue.add('check', {
          keywordId: kw.id,
          keyword: kw.keyword,
          targetDomain: site.domain,
          geo: site.geo,
        }, { repeat: { cron: '0 8 * * *' } });
      }
    }

    return reply.status(201).send(campaign);
  });

  app.patch('/:id/status', async (req, reply) => {
    const { id } = req.params as { id: string };
    const body = z.object({ status: z.enum(['ACTIVE', 'PAUSED', 'COMPLETED']) }).safeParse(req.body);
    if (!body.success) return reply.status(400).send({ error: body.error.flatten() });

    const campaign = await app.prisma.campaign.findFirst({
      where: { id, site: { userId: req.user.userId } },
    });
    if (!campaign) return reply.status(404).send({ error: 'Not found' });

    return app.prisma.campaign.update({ where: { id }, data: { status: body.data.status } });
  });

  app.post('/:id/run', async (req, reply) => {
    const { id } = req.params as { id: string };
    const campaign = await app.prisma.campaign.findFirst({
      where: { id, site: { userId: req.user.userId } },
      include: { keywords: true, site: true },
    });
    if (!campaign) return reply.status(404).send({ error: 'Not found' });
    if (campaign.status !== 'ACTIVE') return reply.status(400).send({ error: 'Campaign is not active' });

    if (campaign.type === 'PF_BOOST') {
      for (const kw of campaign.keywords) {
        await pfQueue.add('visit', {
          visitId: '',
          keywordId: kw.id,
          keyword: kw.keyword,
          targetDomain: campaign.site.domain,
          geo: campaign.site.geo,
          deviceType: campaign.site.deviceType,
          dwellTimeMin: campaign.dwellTimeMin,
          dwellTimeMax: campaign.dwellTimeMax,
          pagesPerSession: campaign.pagesPerSession,
        });
      }
    } else {
      for (const kw of campaign.keywords) {
        await posQueue.add('check', {
          keywordId: kw.id,
          keyword: kw.keyword,
          targetDomain: campaign.site.domain,
          geo: campaign.site.geo,
        });
      }
    }

    return { ok: true, queued: campaign.keywords.length };
  });

  app.delete('/:id', async (req, reply) => {
    const { id } = req.params as { id: string };
    const campaign = await app.prisma.campaign.findFirst({
      where: { id, site: { userId: req.user.userId } },
    });
    if (!campaign) return reply.status(404).send({ error: 'Not found' });
    await app.prisma.campaign.delete({ where: { id } });
    return { ok: true };
  });
}
