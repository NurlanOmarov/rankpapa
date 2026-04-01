export type Plan = 'FREE' | 'START' | 'PRO' | 'AGENCY';

export interface User {
  id: string;
  email: string;
  name: string | null;
  plan: Plan;
  balance: number;
  trialEndsAt: Date | null;
  createdAt: Date;
}
