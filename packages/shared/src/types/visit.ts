export type VisitStatus = 'SUCCESS' | 'FAILED' | 'CAPTCHA' | 'NOT_FOUND';

export interface Visit {
  id: string;
  keywordId: string;
  proxy: string;
  clickPosition: number | null;
  dwellSeconds: number | null;
  pagesVisited: number;
  status: VisitStatus;
  errorMessage: string | null;
  createdAt: Date;
}
