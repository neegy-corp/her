import { withDatabase } from '@/lib/database';
import { address, json, mutationGuard, requestOrigin, setting } from '@/lib/server';
import { authConfigured, newSession, passwordMatches, sessionCookie, sessionValid, throttleKey, validOperatorKey } from '@/lib/operator-auth';
import { loginAllowed, notes, orders, saveNote } from '@/lib/operator-store';
import { intervalMinutes, thesisText, tradeInput } from '@/lib/operator-input';
import { executeTrade, prepareTrade, tradingReady } from '@/lib/operator-trading';
import { reportingFeed, walletReader } from '@/lib/wallet-service';
import { createWalletReader } from '@/lib/wallet-reader';
import { signerConfigured } from '@/lib/operator-signer';
import { previewLoginAllowed } from '@/lib/operator-preview';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;
type Context = { params: Promise<{ key: string }> };
const reply = (data: unknown, status = 200, headers: HeadersInit = {}) => json(data, status, { 'X-Robots-Tag': 'noindex, nofollow, noarchive', 'Referrer-Policy': 'no-referrer', ...headers });
const configured = () => authConfigured(setting('HER_OPERATOR_PASSWORD_HASH'), setting('HER_OPERATOR_SESSION_SECRET'));
const authenticated = (req: Request) => sessionValid(req.headers.get('cookie'), setting('HER_OPERATOR_SESSION_SECRET'), setting('HER_OPERATOR_PASSWORD_HASH'));
const previewOnly = () => setting('HER_WALLET_TRACKING_ENABLED') !== 'true' && setting('HER_OPERATOR_TRADING_ENABLED') !== 'true';
const projectWallet = () => address(setting('HER_WALLET_ADDRESS'));
const coinReader = () => createWalletReader({ wallet: setting('HER_WALLET_ADDRESS') || '11111111111111111111111111111111', apiKey: setting('HELIUS_API_KEY') });
async function visible(context: Context) {
  const { key } = await context.params;
  return setting('HER_OPERATOR_ENABLED') === 'true' && validOperatorKey(key, setting('HER_OPERATOR_PATH_KEY')) ? key : null;
}
export async function GET(req: Request, context: Context) {
  if (!await visible(context)) return reply({ error: 'Not found.' }, 404);
  if (!authenticated(req)) return reply({ authenticated: false, configured: configured() }, 401);
  return withDatabase(setting('DATABASE_URL'), async () => {
    try {
      const walletAddress = setting('HER_WALLET_ADDRESS');
      const action = new URL(req.url).searchParams.get('action') || 'state';
      if (action === 'token') return reply(await coinReader().metadata(address(new URL(req.url).searchParams.get('mint'))));
      if (action !== 'state') return reply({ error: 'Unknown action.' }, 400);
      const tracking = setting('HER_WALLET_TRACKING_ENABLED') === 'true';
      const feed = tracking ? await reportingFeed() : null;
      return reply({ authenticated: true, wallet: walletAddress, tracking, trading: tradingReady(), signerConfigured: signerConfigured(setting('HER_WALLET_PRIVATE_KEY'), walletAddress), preview: previewOnly(), intervalMinutes: intervalMinutes(setting('HER_POSITION_UPDATE_MINUTES')), notes: walletAddress && !previewOnly() ? await notes(walletAddress) : [], orders: walletAddress && !previewOnly() ? await orders(walletAddress) : [], feed });
    } catch { return reply({ error: 'Operator data is unavailable. Check wallet, Helius and database setup.' }, 503); }
  });
}
export async function POST(req: Request, context: Context) {
  const key = await visible(context);
  if (!key) return reply({ error: 'Not found.' }, 404);
  try { mutationGuard(req); } catch { return reply({ error: 'Request origin not allowed.' }, 403); }
  if (!req.headers.get('content-type')?.startsWith('application/json') || Number(req.headers.get('content-length') || 0) > 12000) return reply({ error: 'Invalid request.' }, 400);
  let body: Record<string, unknown>;
  try {
    const text = await req.text();
    if (text.length > 12000) return reply({ error: 'Request too large.' }, 413);
    body = JSON.parse(text);
    if (!body || typeof body !== 'object' || Array.isArray(body)) return reply({ error: 'Invalid request.' }, 400);
  } catch { return reply({ error: 'Invalid request.' }, 400); }
  const secure = new URL(requestOrigin(req)).protocol === 'https:';
  if (!secure && !['localhost', '127.0.0.1'].includes(new URL(requestOrigin(req)).hostname)) return reply({ error: 'HTTPS is required.' }, 403);
  if (body.action === 'logout') return reply({ ok: true }, 200, { 'Set-Cookie': sessionCookie(key, '', secure) });
  if (!configured()) return reply({ error: 'Operator authentication is not configured.' }, 503);
  return withDatabase(setting('DATABASE_URL'), async () => {
    if (body.action === 'login') {
      try {
        const ip = process.env.VERCEL === '1' ? req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown' : 'local';
        const limitKey = throttleKey(ip, setting('HER_OPERATOR_SESSION_SECRET'));
        const allowed = previewOnly() ? previewLoginAllowed(limitKey) : await loginAllowed(limitKey);
        if (!allowed) return reply({ error: 'Too many attempts. Try again in 15 minutes.' }, 429, { 'Retry-After': '900' });
        if (!await passwordMatches(body.password, setting('HER_OPERATOR_PASSWORD_HASH'))) return reply({ error: 'Password did not match.' }, 401);
        return reply({ ok: true }, 200, { 'Set-Cookie': sessionCookie(key, newSession(setting('HER_OPERATOR_SESSION_SECRET'), setting('HER_OPERATOR_PASSWORD_HASH')), secure) });
      } catch { return reply({ error: 'Login is unavailable. Check the database migration and gateway configuration.' }, 503); }
    }
    if (!authenticated(req)) return reply({ error: 'Operator session expired. Sign in again.' }, 401);
    try {
      if (previewOnly()) return reply({ error: 'Preview only. Wallet tracking and trading are disabled.' }, 403);
      if (body.action === 'thesis') {
        const mint = address(body.mint);
        await walletReader().metadata(mint);
        await saveNote(address(setting('HER_WALLET_ADDRESS')), mint, thesisText(body.thesis));
        return reply({ ok: true });
      }
      if (body.action === 'prepare') return reply(await prepareTrade(projectWallet(), tradeInput(body, address)));
      if (body.action === 'execute') {
        if (typeof body.id !== 'string' || !/^[a-f0-9-]{36}$/.test(body.id)) return reply({ error: 'Invalid order.' }, 400);
        if ('signedTransaction' in body) return reply({ error: 'Client-supplied transactions are not accepted.' }, 400);
        return reply(await executeTrade(projectWallet(), body.id));
      }
      return reply({ error: 'Unknown action.' }, 400);
    } catch (error) {
      // Provider, storage and parsing exceptions can contain URLs with keys.
      const message = error instanceof Error ? error.message : '';
      const safe = /^(Enter |Choose |Thesis |Slippage |Amount |Sell amount|Trading is|Connect and verify|Quote expired|Order |Transaction or wallet|Wallet returned|No supported|This route requires|Helius could not)/.test(message) && !message.includes('http');
      return reply({ error: safe ? message : 'The request could not be completed. Refresh activity before retrying a trade.' }, 400);
    }
  });
}
