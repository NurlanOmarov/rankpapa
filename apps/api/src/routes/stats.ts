import { FastifyInstance } from 'fastify';
import { requireAuth } from '../middleware/auth';

export async function statsRoutes(app: FastifyInstance) {
  app.addHook('preHandler', requireAuth);

  // Dashboard overview
  app.get('/overview', async (req) => {
    const userId = req.user.userId;
    const sites = await app.prisma.site.findMany({ where: { userId }, select: { id: true } });
    const siteIds = sites.map((s) => s.id);

    const campaigns = await app.prisma.campaign.findMany({
      where: { siteId: { in: siteIds } },
      select: { id: true },
    });
    const campaignIds = campaigns.map((c) => c.id);

    const keywords = await app.prisma.keyword.findMany({
      where: { campaignId: { in: campaignIds } },
      select: { id: true },
    });
    const keywordIds = keywords.map((k) => k.id);

    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    weekAgo.setHours(0, 0, 0, 0);

    const [visitsToday, visitsTotal, trafficTodayAgg, trafficTotalAgg, latestPositions, visitsHistory] = await Promise.all([
      app.prisma.visit.count({
        where: { keywordId: { in: keywordIds }, createdAt: { gte: todayStart }, status: 'SUCCESS' },
      }),
      app.prisma.visit.count({
        where: { keywordId: { in: keywordIds }, status: 'SUCCESS' },
      }),
      app.prisma.visit.aggregate({
        where: { keywordId: { in: keywordIds }, createdAt: { gte: todayStart }, status: 'SUCCESS' },
        _sum: { trafficBytes: true }
      }),
      app.prisma.visit.aggregate({
        where: { keywordId: { in: keywordIds }, status: 'SUCCESS' },
        _sum: { trafficBytes: true }
      }),
      app.prisma.position.findMany({
        where: { keywordId: { in: keywordIds } },
        orderBy: { checkedAt: 'desc' },
        distinct: ['keywordId'],
        take: 10,
        include: { keyword: true },
      }),
      app.prisma.visit.groupBy({
        by: ['createdAt'],
        where: { 
          keywordId: { in: keywordIds }, 
          createdAt: { gte: weekAgo },
          status: 'SUCCESS'
        },
        _count: true,
      })
    ]);

    // Format visitsHistory to a simple day-by-day array for the chart
    const dailyVisitsMap = new Map<string, number>();
    visitsHistory.forEach((v: any) => {
      const date = v.createdAt.toISOString().split('T')[0];
      dailyVisitsMap.set(date, (dailyVisitsMap.get(date) || 0) + v._count);
    });

    const chartData: number[] = [];
    const chartLabels: string[] = [];
    for (let i = 0; i < 7; i++) {
        const d = new Date(Date.now() - (6 - i) * 24 * 60 * 60 * 1000);
        const key = d.toISOString().split('T')[0];
        chartData.push(dailyVisitsMap.get(key) || 0);
        chartLabels.push(d.toLocaleDateString('ru-RU', { weekday: 'short' }));
    }

    return { 
      visitsToday, 
      visitsTotal, 
      trafficToday: Number(trafficTodayAgg._sum.trafficBytes || 0),
      trafficTotal: Number(trafficTotalAgg._sum.trafficBytes || 0),
      activeSites: siteIds.length, 
      latestPositions, 
      chart: { data: chartData, labels: chartLabels } 
    };
  });

  // Visits chart (last 30 days)
  app.get('/visits/:keywordId', async (req: any, reply: any) => {
    const { keywordId } = req.params as { keywordId: string };
    const keyword = await app.prisma.keyword.findFirst({
      where: { id: keywordId, campaign: { site: { userId: req.user.userId } } },
    });
    if (!keyword) return reply.status(404).send({ error: 'Not found' });

    const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    return app.prisma.visit.findMany({
      where: { keywordId, createdAt: { gte: since } },
      orderBy: { createdAt: 'asc' },
      select: { createdAt: true, status: true, dwellSeconds: true, clickPosition: true },
    });
  });

  // Position history
  app.get('/positions/:keywordId', async (req: any, reply: any) => {
    const { keywordId } = req.params as { keywordId: string };
    const { days } = req.query as { days?: string };
    
    const keyword = await app.prisma.keyword.findFirst({
      where: { id: keywordId, campaign: { site: { userId: req.user.userId } } },
    });
    if (!keyword) return reply.status(404).send({ error: 'Not found' });

    const where: any = { keywordId };
    if (days && !isNaN(parseInt(days))) {
      const dateLimit = new Date();
      dateLimit.setDate(dateLimit.getDate() - parseInt(days));
      where.checkedAt = { gte: dateLimit };
    }

    return app.prisma.position.findMany({
      where,
      orderBy: { checkedAt: 'asc' },
    });
  });
}
