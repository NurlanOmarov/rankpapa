import axios from 'axios';
import { PrismaClient } from '@prisma/client';

type NotificationType = 'SANCTION' | 'BILLING' | 'INFO';

const prisma = new PrismaClient();

export class NotificationService {
  private static botToken = process.env.TELEGRAM_BOT_TOKEN;

  /**
   * Send a notification to a specific user.
   * Creates a DB record and optionally sends a Telegram message.
   */
  static async notify(params: {
    userId: string;
    type: NotificationType;
    message: string;
    telegramChatId?: string | null;
  }) {
    const { userId, type, message, telegramChatId } = params;

    // 1. Save to DB
    const notification = await prisma.notification.create({
      data: { userId, type, message },
    });

    // 2. Send to Telegram if possible
    if (this.botToken && telegramChatId) {
      try {
        const text = this.formatTelegramMessage(type, message);
        await axios.post(`https://api.telegram.org/bot${this.botToken}/sendMessage`, {
          chat_id: telegramChatId,
          text,
          parse_mode: 'HTML',
        });
      } catch (err) {
        console.error('[NotificationService] Telegram send failed:', err);
      }
    }

    return notification;
  }

  private static formatTelegramMessage(type: NotificationType, message: string): string {
    const icons: Record<NotificationType, string> = {
      SANCTION: '🚨 <b>ВНИМАНИЕ: САНКЦИИ</b>',
      BILLING: '💰 <b>ОПЛАТА</b>',
      INFO: 'ℹ️ <b>УВЕДОМЛЕНИЕ</b>',
    };

    return `${icons[type] || '🔔'}\n\n${message}`;
  }
}
