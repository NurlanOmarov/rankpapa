import { FastifyInstance } from 'fastify';
import { requireAuth } from '../middleware/auth';

export async function notificationRoutes(app: FastifyInstance) {
  app.addHook('preHandler', requireAuth);

  // Get notifications
  app.get('/', async (req) => {
    const userId = req.user.userId;
    return app.prisma.notification.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
  });

  // Mark as read
  app.patch('/:id/read', async (req, reply) => {
    const { id } = req.params as { id: string };
    const userId = req.user.userId;

    const notification = await app.prisma.notification.findUnique({
      where: { id },
    });

    if (!notification || notification.userId !== userId) {
      return reply.status(404).send({ error: 'Notification not found' });
    }

    return app.prisma.notification.update({
      where: { id },
      data: { readAt: new Date() },
    });
  });

  // Delete notification
  app.delete('/:id', async (req, reply) => {
    const { id } = req.params as { id: string };
    const userId = req.user.userId;

    const notification = await app.prisma.notification.findUnique({
      where: { id },
    });

    if (!notification || notification.userId !== userId) {
      return reply.status(404).send({ error: 'Notification not found' });
    }

    await app.prisma.notification.delete({ where: { id } });
    return { success: true };
  });
}
