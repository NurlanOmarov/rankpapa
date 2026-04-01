export interface PfBoostJobData {
  visitId: string;
  keywordId: string;
  keyword: string;
  targetDomain: string;
  geo: string;
  deviceType: string;
  dwellTimeMin: number;
  dwellTimeMax: number;
  pagesPerSession: number;
}

export interface PositionCheckJobData {
  keywordId: string;
  keyword: string;
  targetDomain: string;
  geo: string;
}

export const QUEUE_NAMES = {
  PF_BOOST: 'pf-boost',
  POSITION_CHECK: 'position-check',
} as const;
