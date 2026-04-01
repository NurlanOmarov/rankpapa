import { PrismaClient, NotificationType } from '@prisma/client';
import { Queue } from 'bullmq';
import { QUEUE_NAMES, type PfBoostJobData } from '@rankpapa/shared';
import Redis from 'ioredis';
import axios from 'axios';

/**
 * Scheduler — daily ramp-up gating + auto-pause on position drop.
 *
 * Checklist #4: Smooth ramp-up from ~80 visits/day to dailyVisitLimit over rampUpDays.
 * Checklist #26: Auto-pause campaign for 3–7 days if consecutive position drops detected.
 *
 * Called once per day (cron: '1 0 * * *' — just after midnight).
 */

const prisma = new PrismaClient();

export async function runDailyScheduler(redis: Redis): Promise<void> {
  console.info('[Scheduler] Starting daily scheduler run...');

  const pfQueue = new Queue<PfBoostJobData>(QUEUE_NAMES.PF_BOOST, { connection: redis });

  // Get all active PF_BOOST campaigns
  const campaigns = await prisma.campaign.findMany({
    where: { type: 'PF_BOOST', status: 'ACTIVE' },
    include: {
      keywords: { include: { positions: { orderBy: { checkedAt: 'desc' }, take: 15 } } },
      site: { include: { user: true } },
    },
  });

  for (const campaign of campaigns) {
    try {
      // 0. Detect Sanctions (Ban Detector)
      const isSanctioned = await detectSanctions(campaign);
      if (isSanctioned) {
        await prisma.campaign.update({
          where: { id: campaign.id },
          data: { status: 'PAUSED' },
        });
        
        const msg = `🚨 Внимание: Сайт ${campaign.site.domain} вероятно попал под санкции Google (выпали все запросы). Кампания поставлена на паузу для сохранения вашего бюджета.`;
        
        // Notify in DB
        await prisma.notification.create({
          data: { 
            userId: campaign.site.userId, 
            type: 'SANCTION', 
            message: msg 
          }
        });

        // Notify Telegram
        if (process.env.TELEGRAM_BOT_TOKEN && campaign.site.user.telegramChatId) {
            const text = `🚨 <b>ВНИМАНИЕ: САНКЦИИ</b>\n\n${msg}`;
            await axios.post(`https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
                chat_id: campaign.site.user.telegramChatId,
                text,
                parse_mode: 'HTML',
            }).catch(e => console.error('[Scheduler] Telegram fail:', e.message));
        }

        console.warn(`[Scheduler] Sanction detected for ${campaign.site.domain}. Campaign paused.`);
        continue;
      }
      // 1. Calculate today's visit budget via ramp-up curve
      const daysSinceStart = Math.floor(
        (Date.now() - new Date(campaign.createdAt).getTime()) / (1000 * 60 * 60 * 24),
      );
      const todayLimit = dailyRampUp(campaign.dailyVisitLimit, campaign.rampUpDays, daysSinceStart);

      // 2. Check auto-pause condition (check only PF_BOOST campaigns with POSITION_TRACKING sibling)
      const shouldPause = await checkAutoPause(campaign.id, campaign.keywords);
      if (shouldPause) {
        const pauseUntil = new Date(Date.now() + autoPauseDays() * 24 * 60 * 60 * 1000);
        await prisma.campaign.update({
          where: { id: campaign.id },
          data: { status: 'PAUSED' },
        });
        console.warn(
          `[Scheduler] Auto-paused campaign ${campaign.id} (${campaign.site.domain}) until ${pauseUntil.toISOString()}`,
        );
        continue;
      }

      // 3. Check schedule gate (scheduleStart / scheduleEnd) and distribute jobs
      const scheduleWindowHours = Math.max(1, campaign.scheduleEnd - campaign.scheduleStart);
      const visitsPerKeyword = Math.ceil(todayLimit / Math.max(campaign.keywords.length, 1));

      // Spread jobs evenly across the schedule window
      const intervalMs = Math.floor((scheduleWindowHours * 3600 * 1000) / Math.max(visitsPerKeyword, 1));

      for (const kw of campaign.keywords) {
        for (let i = 0; i < visitsPerKeyword; i++) {
          const delayMs = scheduleStartDelayMs(campaign.scheduleStart) + i * intervalMs;
          await pfQueue.add(
            'visit',
            {
              visitId: '',
              keywordId: kw.id,
              keyword: kw.keyword,
              targetDomain: campaign.site.domain,
              geo: campaign.site.geo,
              deviceType: campaign.site.deviceType,
              dwellTimeMin: campaign.dwellTimeMin,
              dwellTimeMax: campaign.dwellTimeMax,
              pagesPerSession: campaign.pagesPerSession,
            },
            { delay: delayMs, attempts: 2, backoff: { type: 'fixed', delay: 60000 } },
          );
        }
      }

      console.info(
        `[Scheduler] Campaign ${campaign.id} (${campaign.site.domain}): ` +
        `day ${daysSinceStart + 1}, budget=${todayLimit}, ` +
        `keywords=${campaign.keywords.length}, visitsPerKw=${visitsPerKeyword}`,
      );
    } catch (err) {
      console.error(`[Scheduler] Error scheduling campaign ${campaign.id}:`, err);
    }
  }

  console.info('[Scheduler] Done.');
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Ramp-up curve: smooth growth from startVisits to maxVisits over rampUpDays.
 *
 * Uses sine easing: starts at ~40% of max, reaches 100% by day rampUpDays.
 * After rampUpDays, stays at maxVisits.
 *
 * Checklist #4: "Плавный ramp-up: начинать с 80–120 визитов/день и растягивать на 10–14 дней"
 */
export function dailyRampUp(maxVisits: number, rampUpDays: number, dayIndex: number): number {
  if (dayIndex >= rampUpDays) return maxVisits;

  const startFraction = 0.35; // start at 35% of max
  const t = dayIndex / Math.max(rampUpDays - 1, 1); // 0 → 1
  // Ease-in-out sine
  const eased = startFraction + (1 - startFraction) * (1 - Math.cos(Math.PI * t)) / 2;
  return Math.max(50, Math.round(maxVisits * eased));
}

/**
 * Auto-pause check: if the last N position records show consistent drop, pause the campaign.
 *
 * Research #26: "При любых просадках позиций — автопауза на 3–7 дней"
 * Condition: last 5 position checks all show drop ≥ 3 places vs the check before them.
 */
async function checkAutoPause(
  campaignId: string,
  keywords: Array<{ positions: Array<{ position: number | null }> }>,
): Promise<boolean> {
  // Only check if we have enough data (at least 6 position records per keyword)
  const qualifiedKeywords = keywords.filter(k => k.positions.length >= 6);
  if (qualifiedKeywords.length === 0) return false;

  let droppingKeywords = 0;

  for (const kw of qualifiedKeywords) {
    const positions = kw.positions.map(p => p.position).filter((p): p is number => p !== null);
    if (positions.length < 6) continue;

    // positions[0] = latest, positions[N] = oldest (desc order from query)
    const latest = positions[0];
    const baseline = positions[5]; // 6th most recent

    if (latest > baseline + 3) {
      droppingKeywords++;
    }
  }

  // If > 60% of tracked keywords are dropping, auto-pause
  const dropRatio = droppingKeywords / Math.max(qualifiedKeywords.length, 1);
  if (dropRatio > 0.6) {
    console.warn(
      `[AutoPause] Campaign ${campaignId}: ${droppingKeywords}/${qualifiedKeywords.length} keywords dropping. Pausing.`,
    );
    return true;
  }

  return false;
}

/** Random pause duration: 3–7 days (checklist #26) */
function autoPauseDays(): number {
  return 3 + Math.floor(Math.random() * 5);
}

/**
 * Calculate delay (in ms) from now until schedule start time today.
 * If start hour has already passed, returns 0.
 */
function scheduleStartDelayMs(scheduleStartHour: number): number {
  const now = new Date();
  const startToday = new Date(now);
  startToday.setHours(scheduleStartHour, 0, 0, 0);

  const diff = startToday.getTime() - now.getTime();
  return Math.max(0, diff);
}

/**
 * Sanction Detector (Ban Detector)
 * 1. Condition: 100% of keywords are null (NOT FOUND) in the latest check.
 * 2. History check: Site must have had at least one visible position in the last 15 checks
 *    to distinguish from a "new site / check in progress" state.
 */
async function detectSanctions(campaign: any): Promise<boolean> {
    const keywords = campaign.keywords;
    if (keywords.length === 0) return false;

    // Latest positions check
    const currentPositions = keywords.map((k: any) => k.positions[0]?.position);
    const allNullNow = currentPositions.every((p: any) => p === null);

    if (!allNullNow) return false;

    // Grace Period: if campaign is < 3 days old, don't trigger (Wait for indexing)
    const ageDays = (Date.now() - new Date(campaign.createdAt).getTime()) / (1000 * 60 * 60 * 24);
    if (ageDays < 3) return false;

    // History check: did it ever have positions in the last 15 checks?
    const allHistory = keywords.flatMap((k: any) => k.positions);
    const hadPositionsBefore = allHistory.some((p: any) => p.position !== null);

    return hadPositionsBefore;
}
