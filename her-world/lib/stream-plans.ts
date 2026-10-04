export const streamPlans = [15, 30, 45, 60].map(minutes => ({
  minutes, tokens: minutes / 15 * 50000, seconds: minutes * 60,
}));
export const VIDEO_CREDIT_EXHAUSTED = "Video allowance exhausted. Add ACP credits to continue.";
export function streamPlan(minutes: unknown) {
  const plan = streamPlans.find(p => p.minutes === minutes);
  if (!plan) throw new Error("Choose 15, 30, 45 or 60 minutes.");
  return plan;
}
export type StreamCreditState = {
  enabled: boolean; mint: string | null; symbol: string;
  streamSeconds: number; videoSeconds: number; endsAt: number;
  serverNow: number; sessionId: string | null;
  pending: { id: string; minutes: number; signature: string | null; status: string }[];
};
