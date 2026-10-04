export const VIDEO_CREDIT_EXHAUSTED = "Video time used up. Collect your coin's trading fees, then buy more time.";
// Purchasable lengths. Price is linear in seconds, so any length costs the same per second.
export const STREAM_PLAN_MINUTES = [5, 10, 15, 20, 25] as const;
export const streamPlans = STREAM_PLAN_MINUTES.map(minutes => ({ minutes, seconds: minutes * 60 }));
export function streamPlan(minutes: unknown) {
  const plan = streamPlans.find(p => p.minutes === minutes);
  if (!plan) throw new Error("Choose 5, 10, 15, 20 or 25 minutes.");
  return plan;
}
export type TimeQuote = { minutes: number; seconds: number; lamports: number; usd: number };
export type StreamCreditState = {
  enabled: boolean;
  streamSeconds: number; videoSeconds: number; endsAt: number;
  portraitCredits: number; scriptCredits: number;
  serverNow: number; sessionId: string | null;
  freeSeconds: number; freeGranted: boolean;
  feeSetup: "none" | "submitted" | "confirmed";
  // SOL held in the character's launch wallet (its half of the trading fees), or null if unreadable.
  walletLamports: number | null;
  // Null until the SOL price is available.
  quotes: TimeQuote[] | null;
  pending: { signature: string }[];
};
