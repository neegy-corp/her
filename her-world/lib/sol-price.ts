import { setting } from "./server";
import { ACP_VIDEO_USD_PER_SECOND } from "./acp-config";
import { streamPlans, type TimeQuote } from "./stream-plans";
// Pyth's SOL/USD feed through Hermes. Needs no key.
const PYTH_SOL_USD = "ef0d8b6fda2ceba41da15d4095d1da392a0d2f8ed0c6c7bc0f4cfac8c280b56d";
let cached: { usd: number; at: number } | null = null;
const MAX_AGE = 60_000;
export const videoUsdPerSecond = () => {
  const n = Number(setting("ACP_VIDEO_USD_PER_SECOND"));
  return Number.isFinite(n) && n > 0 && n < 10 ? n : ACP_VIDEO_USD_PER_SECOND;
};
export async function solUsd(now = Date.now()) {
  const manual = Number(setting("ACP_SOL_USD_OVERRIDE"));
  if (process.env.NODE_ENV !== "production" && Number.isFinite(manual) && manual > 0) return manual;
  if (cached && now - cached.at < MAX_AGE) return cached.usd;
  const response = await fetch(`https://hermes.pyth.network/v2/updates/price/latest?ids[]=${PYTH_SOL_USD}&parsed=true`, { signal: AbortSignal.timeout(8000) });
  if (!response.ok) throw new Error("SOL price is unavailable right now.");
  const parsed = ((await response.json()) as { parsed?: { price: { price: string; expo: number; publish_time: number } }[] }).parsed?.[0]?.price;
  const usd = parsed ? Number(parsed.price) * 10 ** parsed.expo : NaN;
  // Reject stale or implausible prices rather than charging from them.
  if (!parsed || !Number.isFinite(usd) || usd < 5 || usd > 5000 || !Number.isFinite(parsed.publish_time) || now / 1000 - parsed.publish_time > 120 || parsed.publish_time - now / 1000 > 15)
    throw new Error("SOL price is unavailable right now.");
  cached = { usd, at: now };
  return usd;
}
export const lamportsFor = (seconds: number, usdPerSecond: number, price: number) =>
  Math.ceil((seconds * usdPerSecond * 1e9) / price);
export async function timeQuotes(): Promise<TimeQuote[]> {
  const price = await solUsd(), rate = videoUsdPerSecond();
  return streamPlans.map(p => ({ minutes: p.minutes, seconds: p.seconds, lamports: lamportsFor(p.seconds, rate, price), usd: Math.round(p.seconds * rate * 100) / 100 }));
}
export const resetSolPriceCache = () => { cached = null; };
