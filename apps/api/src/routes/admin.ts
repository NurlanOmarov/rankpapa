import { FastifyInstance } from 'fastify';

export async function adminRoutes(app: FastifyInstance) {
  // Basic admin auth (extend with role check later)
  app.addHook('preHandler', async (req, reply) => {
    try {
      await req.jwtVerify();
    } catch {
      return reply.status(401).send({ error: 'Unauthorized' });
    }
  });

  app.get('/users', async () => {
    return app.prisma.user.findMany({
      select: { id: true, email: true, name: true, plan: true, balance: true, createdAt: true },
      orderBy: { createdAt: 'desc' },
    });
  });

  app.get('/proxies', async () => {
    return app.prisma.proxy.findMany({ orderBy: { lastUsedAt: 'desc' } });
  });

  app.get('/stats', async () => {
    const [users, visits, proxies] = await Promise.all([
      app.prisma.user.count(),
      app.prisma.visit.count(),
      app.prisma.proxy.count({ where: { status: 'ACTIVE' } }),
    ]);
    return { users, visits, activeProxies: proxies };
  });
}
