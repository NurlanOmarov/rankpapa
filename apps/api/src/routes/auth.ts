import { FastifyInstance } from 'fastify';
import bcrypt from 'bcryptjs';
import { z } from 'zod';

const RegisterSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  name: z.string().optional(),
});

const LoginSchema = z.object({
  email: z.string().email(),
  password: z.string(),
});

export async function authRoutes(app: FastifyInstance) {
  app.post('/register', async (_req, reply) => {
    return reply.status(403).send({ error: 'Registration is disabled' });
  });

  app.post('/login', async (req, reply) => {
    const body = LoginSchema.safeParse(req.body);
    if (!body.success) return reply.status(400).send({ error: body.error.flatten() });

    const user = await app.prisma.user.findUnique({ where: { email: body.data.email } });
    if (!user) return reply.status(401).send({ error: 'Invalid credentials' });

    const valid = await bcrypt.compare(body.data.password, user.passwordHash);
    if (!valid) return reply.status(401).send({ error: 'Invalid credentials' });

    const token = app.jwt.sign({ userId: user.id, email: user.email });
    const { passwordHash: _, ...safeUser } = user;
    return { token, user: safeUser };
  });

  app.get('/me', { preHandler: async (req, reply) => { try { await req.jwtVerify(); } catch { reply.status(401).send({ error: 'Unauthorized' }); } } }, async (req) => {
    const user = await app.prisma.user.findUnique({
      where: { id: req.user.userId },
      select: { id: true, email: true, name: true, plan: true, balance: true, trialEndsAt: true, createdAt: true },
    });
    return user;
  });
}
