export interface Position {
  id: string;
  keywordId: string;
  position: number | null; // null = not in top 100
  url: string | null;
  checkedAt: Date;
}
