export type CampaignType = 'PF_BOOST' | 'POSITION_TRACKING';
export type CampaignStatus = 'ACTIVE' | 'PAUSED' | 'COMPLETED';

export interface Campaign {
  id: string;
  siteId: string;
  type: CampaignType;
  status: CampaignStatus;
  dailyVisitLimit: number;
  dwellTimeMin: number; // seconds
  dwellTimeMax: number; // seconds
  pagesPerSession: number;
  rampUpDays: number;
  scheduleStart: number; // hour 0-23
  scheduleEnd: number;   // hour 0-23
  createdAt: Date;
}

export interface Keyword {
  id: string;
  campaignId: string;
  keyword: string;
  targetUrl: string | null;
}
