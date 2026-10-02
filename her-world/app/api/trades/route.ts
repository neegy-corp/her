import { json, setting } from '@/lib/server';
import { createTradesReader } from '@/lib/trades-reader';
import { emptyTrades } from '@/lib/trades-types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;
let current: { wallet: string; key: string; reader: ReturnType<typeof createTradesReader> } | undefined;
export async function GET() {
  if (setting('HER_WALLET_TRACKING_ENABLED') !== 'true') return json(emptyTrades('paused'));
  const wallet = setting('HER_WALLET_ADDRESS'), key = setting('HELIUS_API_KEY');
  if (!wallet || !key) return json(emptyTrades('unconfigured'));
  try {
    if (!current || current.wallet !== wallet || current.key !== key) current = { wallet, key, reader: createTradesReader(wallet, key) };
    return json(await current.reader.portfolio(), 200, { 'Cache-Control': 'public, s-maxage=30, stale-while-revalidate=30' });
  } catch { return json(emptyTrades('unavailable'), 503); }
}
