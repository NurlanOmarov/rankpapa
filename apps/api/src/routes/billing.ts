import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { requireAuth } from '../middleware/auth';

export async function billingRoutes(app: FastifyInstance) {
  app.addHook('preHandler', requireAuth);

  // Get transaction history
  app.get('/transactions', async (req: any) => {
    return app.prisma.transaction.findMany({
      where: { userId: req.user.userId },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
  });

  // Top up balance (Stub implementation for demo)
  app.post('/topup', async (req: any, reply: any) => {
    const body = z.object({
      amount: z.number().min(10).max(10000),
    }).safeParse(req.body);

    if (!body.success) {
      return reply.status(400).send({ error: body.error.flatten() });
    }

    const { amount } = body.data;

    // In a real app, this would involve Stripe/PayPal integration.
    // Here we just update the user balance and create a transaction for the demo.
    const [user, transaction] = await app.prisma.$transaction([
      app.prisma.user.update({
        where: { id: req.user.userId },
        data: { balance: { increment: amount } },
      }),
      app.prisma.transaction.create({
        data: {
          userId: req.user.userId,
          amount,
          type: 'DEPOSIT',
          comment: 'Пополнение баланса (Тест)',
        },
      }),
    ]);

    return { balance: user.balance, transaction };
  });

  // Switch subscription plan
  app.post('/plan', async (req: any, reply: any) => {
    const body = z.object({
      plan: z.enum(['FREE', 'START', 'PRO', 'AGENCY']),
    }).safeParse(req.body);

    if (!body.success) {
      return reply.status(400).send({ error: body.error.flatten() });
    }

    const user = await app.prisma.user.update({
      where: { id: req.user.userId },
      data: { plan: body.data.plan },
    });

    return { plan: user.plan };
  });
}
