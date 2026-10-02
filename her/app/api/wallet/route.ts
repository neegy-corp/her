import { authorize, json, setting } from '@/lib/server-config';
import { walletFeed } from '@/lib/wallet-updates';

export async function GET(request: Request) {
  const denied = await authorize(request); if (denied) return denied;
  if (setting('HER_WALLET_UPDATES_ENABLED') !== 'true') return json({ enabled: false });
  try {
    const url = new URL(setting('HER_WALLET_FEED_URL'));
    const token = setting('HER_WALLET_READ_TOKEN');
    if (url.protocol !== 'https:' || url.username || url.password || token.length < 32) throw new Error('Wallet feed is not configured.');
    url.searchParams.set('action', 'feed');
    // Workerd supports manual/follow only. Reject redirects without forwarding
    // the private read token to another destination.
    const response = await fetch(url, { headers: { Authorization: `Bearer ${token}` }, redirect: 'manual', cache: 'no-store', signal: AbortSignal.timeout(20000) });
    if (!response.ok) throw new Error('Wallet feed is unavailable.');
    const raw = await response.text();
    if (raw.length > 64000) throw new Error('Wallet feed exceeds the tracking limit.');
    const data: unknown = JSON.parse(raw);
    if (data && typeof data === 'object' && 'enabled' in data && data.enabled === false) return json({ enabled: false });
    return json(walletFeed(data));
  } catch { return json({ error: 'Wallet updates are unavailable; HER will not invent activity.' }, 503); }
}
