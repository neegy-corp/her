import { json, setting } from '@/lib/server';
import { walletAuthorized } from '@/lib/wallet-reader';
import { reportingFeed } from '@/lib/wallet-service';
import { withDatabase } from '@/lib/database';
export const runtime = 'nodejs';
export const maxDuration = 60;

export async function GET(request: Request) {
  if (!walletAuthorized(request, setting('HER_WALLET_READ_TOKEN'))) return json({ error: 'Unauthorized.' }, 401);
  if (setting('HER_WALLET_TRACKING_ENABLED') !== 'true') return json({ enabled: false, readOnly: true });
  const action = new URL(request.url).searchParams.get('action') || 'portfolio';
  if (action !== 'feed' && action !== 'portfolio') return json({ error: 'Unknown wallet action.' }, 400);
  try {
    return json(await withDatabase(setting('DATABASE_URL'), reportingFeed));
  } catch {
    return json({ error: 'Wallet tracking is unavailable. Check server configuration and Helius access.' }, 503);
  }
}
