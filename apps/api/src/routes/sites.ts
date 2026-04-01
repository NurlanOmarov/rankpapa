import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { requireAuth } from '../middleware/auth';

const CreateSiteSchema = z.object({
  domain: z.string().min(3),
  geo: z.enum(['ALMATY', 'ASTANA', 'SHYMKENT', 'ALL']).default('ALMATY'),
  deviceType: z.enum(['DESKTOP', 'MOBILE', 'MIXED']).default('MIXED'),
});

const UpdateSiteSchema = CreateSiteSchema.partial().extend({
  status: z.enum(['ACTIVE', 'PAUSED', 'ARCHIVED']).optional(),
});

export async function sitesRoutes(app: FastifyInstance) {
  app.addHook('preHandler', requireAuth);

  app.get('/', async (req) => {
    return app.prisma.site.findMany({
      where: { userId: req.user.userId },
      include: { campaigns: { include: { keywords: true } } },
      orderBy: { createdAt: 'desc' },
    });
  });

  app.post('/', async (req, reply) => {
    const body = CreateSiteSchema.safeParse(req.body);
    if (!body.success) return reply.status(400).send({ error: body.error.flatten() });

    // strip protocol/trailing slash
    const domain = body.data.domain.replace(/^https?:\/\//, '').replace(/\/$/, '').toLowerCase();

    const site = await app.prisma.site.create({
      data: { ...body.data, domain, userId: req.user.userId },
    });
    return reply.status(201).send(site);
  });

  app.get('/:id', async (req, reply) => {
    const { id } = req.params as { id: string };
    const site: any = await app.prisma.site.findFirst({
      where: { id, userId: req.user.userId },
      include: { campaigns: { include: { keywords: true }, orderBy: { createdAt: 'desc' } } },
    });
    if (!site) return reply.status(404).send({ error: 'Not found' });

    // Aggregate traffic per campaign
    for (const campaign of site.campaigns) {
      const kwIds = campaign.keywords.map((k: any) => k.id);
      const traffic = await app.prisma.visit.aggregate({
        where: { keywordId: { in: kwIds }, status: 'SUCCESS' },
        _sum: { trafficBytes: true }
      });
      campaign.totalTraffic = Number(traffic._sum.trafficBytes || 0);
    }

    return site;
  });

  app.patch('/:id/status', async (req, reply) => {
    const { id } = req.params as { id: string };
    const { status } = req.body as { status: 'ACTIVE' | 'PAUSED' | 'ARCHIVED' };
    const site = await app.prisma.site.findFirst({ where: { id, userId: req.user.userId } });
    if (!site) return reply.status(404).send({ error: 'Not found' });
    return app.prisma.site.update({ where: { id }, data: { status } });
  });

  app.patch('/:id', async (req, reply) => {
    const { id } = req.params as { id: string };
    const body = UpdateSiteSchema.safeParse(req.body);
    if (!body.success) return reply.status(400).send({ error: body.error.flatten() });

    const site = await app.prisma.site.findFirst({ where: { id, userId: req.user.userId } });
    if (!site) return reply.status(404).send({ error: 'Not found' });

    return app.prisma.site.update({ where: { id }, data: body.data });
  });

  app.delete('/:id', async (req, reply) => {
    const { id } = req.params as { id: string };
    const site = await app.prisma.site.findFirst({ where: { id, userId: req.user.userId } });
    if (!site) return reply.status(404).send({ error: 'Not found' });
    await app.prisma.site.delete({ where: { id } });
    return { ok: true };
  });
}
