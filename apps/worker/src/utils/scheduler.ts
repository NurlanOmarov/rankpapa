import { Queue } from 'bullmq';
import { PrismaClient } from '@prisma/client';
import Redis from 'ioredis';
import { QUEUE_NAMES, type PfBoostJobData, type PositionCheckJobData } from '@rankpapa/shared';

/**
 * Scheduler: runs every minute, dispatches jobs respecting:
 *
 * Checklist #4:  Gradual ramp-up: start with 80–120 visits/day, +10%/day over rampUpDays.
 * Checklist #15: Distribute visits across scheduleStart–scheduleEnd hours,
 *                with more weight on business hours.
 */

const prisma = new PrismaClient();

export class Scheduler {
  private pfQueue: Queue<PfBoostJobData>;
  private posQueue: Queue<PositionCheckJobData>;
  private timer: NodeJS.Timeout | null = null;

  constructor(redis: Redis) {
    this.pfQueue = new Queue(QUEUE_NAMES.PF_BOOST, { connection: redis });
    this.posQueue = new Queue(QUEUE_NAMES.POSITION_CHECK, { connection: redis });
  }

  start(): void {
    this.tick();
    // Run every minute
    this.timer = setInterval(() => this.tick(), 60 * 1000);
    console.info('[Scheduler] Started');
  }

  stop(): void {
    if (this.timer) clearInterval(this.timer);
  }

  private async tick(): Promise<void> {
    const nowHour = new Date().getHours(); // server local hour (set to Asia/Almaty on VPS)
    const nowMinute = new Date().getMinutes();

    try {
      await this.dispatchPfJobs(nowHour, nowMinute);
      await this.dispatchPositionJobs(nowHour, nowMinute);
    } catch (err) {
      console.error('[Scheduler] tick error:', err);
    }
  }

  private async dispatchPfJobs(hour: number, minute: number): Promise<void> {
    const campaigns = await prisma.campaign.findMany({
      where: { type: 'PF_BOOST', status: 'ACTIVE' },
      include: {
        keywords: {
          include: { positions: { orderBy: { checkedAt: 'desc' }, take: 7 } },
        },
        site: true,
      },
    });

    for (const campaign of campaigns) {
      // Checklist #15: only dispatch within scheduled hours
      if (hour < campaign.scheduleStart || hour >= campaign.scheduleEnd) continue;

      // Checklist #26: auto-pause if positions are consistently dropping
      if (await this.shouldAutoPause(campaign.keywords)) {
        const pauseDays = 3 + Math.floor(Math.random() * 5);
        await prisma.campaign.update({ where: { id: campaign.id }, data: { status: 'PAUSED' } });
        console.warn(`[Scheduler] Auto-paused campaign ${campaign.id} (${campaign.site.domain}) for ~${pauseDays}d due to position drop`);
        continue;
      }

      // Checklist #4: calculate today's allowed limit based on ramp-up
      const daysSinceCreation = Math.floor(
        (Date.now() - campaign.createdAt.getTime()) / (1000 * 60 * 60 * 24),
      );
      const rampFactor = Math.min(1, (daysSinceCreation + 1) / campaign.rampUpDays);
      const todayLimit = Math.floor(campaign.dailyVisitLimit * rampFactor);

      // Count visits already done today
      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);
      const visitsTodayCount = await prisma.visit.count({
        where: {
          keywordId: { in: campaign.keywords.map((k: any) => k.id) },
          createdAt: { gte: todayStart },
          status: { in: ['SUCCESS', 'FAILED'] },
        },
      });

      if (visitsTodayCount >= todayLimit) continue;

      // Spread visits across operating hours (checklist #15)
      const activeHours = campaign.scheduleEnd - campaign.scheduleStart;
      const visitsPerHour = todayLimit / activeHours;
      const expectedByNow = visitsPerHour * (hour - campaign.scheduleStart + minute / 60);
      const deficit = Math.floor(expectedByNow - visitsTodayCount);

      if (deficit <= 0) continue;

      // Dispatch one job per keyword in round-robin (up to deficit)
      let dispatched = 0;
      for (const keyword of campaign.keywords) {
        if (dispatched >= deficit) break;
        if (dispatched >= 3) break; // max 3 per tick to avoid bursts

        await this.pfQueue.add(
          'visit',
          {
            visitId: '',
            keywordId: keyword.id,
            keyword: keyword.keyword,
            targetDomain: campaign.site.domain,
            geo: campaign.site.geo,
            deviceType: campaign.site.deviceType,
            dwellTimeMin: campaign.dwellTimeMin,
            dwellTimeMax: campaign.dwellTimeMax,
            pagesPerSession: campaign.pagesPerSession,
          },
          {
            // Random delay up to 45s within the minute (checklist #15: no fixed timing)
            delay: Math.floor(Math.random() * 45000),
            attempts: 2,
            backoff: { type: 'exponential', delay: 5000 },
          },
        );
        dispatched++;
      }
    }
  }

  private async dispatchPositionJobs(hour: number, minute: number): Promise<void> {
    // Position checks run once a day at 8:00 AM Almaty time
    if (hour !== 8 || minute > 5) return;

    const campaigns = await prisma.campaign.findMany({
      where: { type: 'POSITION_TRACKING', status: 'ACTIVE' },
      include: { keywords: true, site: true },
    });

    for (const campaign of campaigns) {
      for (const keyword of campaign.keywords) {
        // Avoid double-dispatch
        const alreadyToday = await prisma.position.findFirst({
          where: {
            keywordId: keyword.id,
            checkedAt: { gte: new Date(new Date().setHours(0, 0, 0, 0)) },
          },
        });
        if (alreadyToday) continue;

        await this.posQueue.add(
          'check',
          {
            keywordId: keyword.id,
            keyword: keyword.keyword,
            targetDomain: campaign.site.domain,
            geo: campaign.site.geo,
          },
          { delay: Math.floor(Math.random() * 120000) }, // spread over 2 min
        );
      }
    }
  }

  /**
   * Auto-pause check (checklist #26).
   * Returns true if >60% of keywords with ≥6 position records show consistent drop of 3+ places.
   */
  private async shouldAutoPause(
    keywords: Array<{ positions: Array<{ position: number | null }> }>,
  ): Promise<boolean> {
    const qualified = keywords.filter((k) => k.positions.length >= 6);
    if (qualified.length === 0) return false;

    let dropping = 0;
    for (const kw of qualified) {
      const positions = kw.positions
        .map((p) => p.position)
        .filter((p): p is number => p !== null);
      if (positions.length < 6) continue;
      // positions[0] = latest (desc order); positions[5] = 6th most recent
      if (positions[0] > positions[5] + 3) dropping++;
    }

    return dropping / qualified.length > 0.6;
  }
}
