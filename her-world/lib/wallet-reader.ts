import { timingSafeEqual } from 'node:crypto';

export const NATIVE_SOL = 'So11111111111111111111111111111111111111111';
const WRAPPED_SOL = 'So11111111111111111111111111111111111111112';
const USDC = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v';
const addressPattern = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;
const signaturePattern = /^[1-9A-HJ-NP-Za-km-z]{80,90}$/;
type ObjectValue = Record<string, unknown>;
export type WalletChange = { mint: string; amount: number };
export type TokenDetails = { mint: string; name: string; symbol: string; decimals: number };
export type WalletTrade = { signature: string; timestamp: number; confirmation: 'confirmed' | 'finalized'; side: 'buy' | 'sell' | 'swap'; changes: WalletChange[] };
export type WalletFeed = { enabled: true; wallet: string; observedAt: number; readOnly: true; trades: WalletTrade[]; historyTruncated: boolean };
export type WalletReaderConfig = { wallet: string; apiKey: string };
const object = (value: unknown): value is ObjectValue => !!value && typeof value === 'object' && !Array.isArray(value);
const number = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value);
const mint = (value: unknown) => value === 'SOL' || value === NATIVE_SOL ? 'SOL' : typeof value === 'string' && addressPattern.test(value) ? value : null;
const quote = (value: string) => value === 'SOL' || value === WRAPPED_SOL || value === USDC;
const label = (value: unknown, max: number) => typeof value === 'string' ? value.replace(/[\u0000-\u001f\u007f]/g, ' ').trim().slice(0, max) : '';

export function walletAuthorized(request: Request, secret: string) {
  if (secret.length < 32) return false;
  const received = Buffer.from(request.headers.get('authorization') || '');
  const expected = Buffer.from(`Bearer ${secret}`);
  return received.length === expected.length && timingSafeEqual(received, expected);
}

export function normalizePositions(value: unknown) {
  if (!object(value) || !Array.isArray(value.balances) || !object(value.pagination) || typeof value.pagination.hasMore !== 'boolean') throw new Error('Invalid Helius balances response.');
  const positions = value.balances.slice(0, 20).flatMap(row => {
    if (!object(row)) return [];
    const id = mint(row.mint);
    if (!id || !number(row.balance) || row.balance <= 0) return [];
    const symbol = typeof row.symbol === 'string' && /^[A-Za-z0-9$_.-]{1,20}$/.test(row.symbol) ? row.symbol : undefined;
    const name = label(row.name, 80);
    const priceUsd = number(row.pricePerToken) && row.pricePerToken > 0 ? row.pricePerToken : null;
    return [{ mint: id, amount: row.balance, name, ...(symbol ? { symbol } : {}), priceUsd, valueUsd: priceUsd && Number.isFinite(priceUsd * row.balance) ? priceUsd * row.balance : null }];
  });
  return { positions, holdingsTruncated: value.pagination.hasMore || value.balances.length > 20, pnl: null, pricing: 'Helius Wallet API indicative USD marks refresh hourly, not live executable quotes. Mark timestamp and cost basis unavailable; do not infer profit/loss.' };
}

export function tokenDetails(value: unknown, id: string): TokenDetails {
  if (!object(value) || value.id !== id || !['FungibleToken', 'FungibleAsset'].includes(String(value.interface)) || !object(value.token_info) || !Number.isInteger(value.token_info.decimals) || Number(value.token_info.decimals) < 0 || Number(value.token_info.decimals) > 18) throw new Error('Helius could not identify a fungible token at this address.');
  const metadata = object(value.content) && object(value.content.metadata) ? value.content.metadata : {};
  const name = label(metadata.name, 80);
  const symbol = label(value.token_info.symbol || metadata.symbol, 20).replace(/[^A-Za-z0-9$_.-]/g, '');
  return { mint: id, name, symbol, decimals: Number(value.token_info.decimals) };
}

export function historyRows(value: unknown) {
  if (!object(value) || !Array.isArray(value.data) || !object(value.pagination) || typeof value.pagination.hasMore !== 'boolean') throw new Error('Invalid Helius history response.');
  return { rows: value.data.slice(0, 20), historyTruncated: value.pagination.hasMore || value.data.length > 20 };
}

// Only call this for Helius history explicitly filtered to SWAP, never transfers.
export function normalizeSwaps(rows: unknown[], statuses: unknown, wallet: string): WalletTrade[] {
  if (!Array.isArray(statuses) || statuses.length !== rows.length) throw new Error('Invalid transaction confirmation response.');
  const seen = new Set<string>();
  return rows.flatMap<WalletTrade>((row, index) => {
    const status = statuses[index];
    if (!object(row) || !object(status) || row.error !== null || status.err !== null) return [];
    const confirmation = status.confirmationStatus;
    if (confirmation !== 'confirmed' && confirmation !== 'finalized') return [];
    if (row.type !== undefined && row.type !== 'SWAP') return [];
    if (typeof row.signature !== 'string' || !signaturePattern.test(row.signature) || seen.has(row.signature)) return [];
    if (!number(row.timestamp) || !Number.isSafeInteger(row.timestamp) || row.timestamp <= 0 || !Array.isArray(row.balanceChanges) || row.balanceChanges.length > 8) return [];
    const amounts = new Map<string, number>();
    for (const change of row.balanceChanges) {
      if (!object(change)) return [];
      const id = mint(change.mint);
      if (!id || !number(change.amount)) return [];
      amounts.set(id, (amounts.get(id) || 0) + change.amount);
    }
    const changes = [...amounts].filter(([, amount]) => Number.isFinite(amount) && amount !== 0).map(([mint, amount]) => ({ mint, amount }));
    const assets = changes.filter(change => !quote(change.mint));
    const spent = changes.some(change => quote(change.mint) && change.amount < 0);
    const received = changes.some(change => quote(change.mint) && change.amount > 0);
    if (!changes.some(change => change.amount > 0) || !changes.some(change => change.amount < 0)) return [];
    // Balance changes include fees/rent. Do not invent execution prices or fills.
    const side = assets.length === 1 && assets[0].amount > 0 && spent ? 'buy' : assets.length === 1 && assets[0].amount < 0 && received ? 'sell' : 'swap';
    if (row.feePayer !== undefined && row.feePayer !== wallet) return [];
    seen.add(row.signature);
    return [{ signature: row.signature, timestamp: row.timestamp * 1000, confirmation, side, changes }];
  }).sort((a, b) => b.timestamp - a.timestamp);
}

export function createWalletReader(config: WalletReaderConfig, fetcher: typeof fetch = fetch, now = Date.now) {
  if (!addressPattern.test(config.wallet) || !config.apiKey.trim()) throw new Error('Wallet tracking is not configured.');
  const cache = new Map<string, { expires: number; result: Promise<unknown> }>();
  async function request(url: string, init: RequestInit = {}) {
    const response = await fetcher(url, { ...init, redirect: 'error', cache: 'no-store', signal: AbortSignal.timeout(12000) });
    if (!response.ok) throw new Error('Helius wallet data is temporarily unavailable.');
    const raw = await response.text();
    if (raw.length > 1000000) throw new Error('Helius response exceeds the tracking limit.');
    return JSON.parse(raw) as unknown;
  }
  async function rpc(method: string, params: unknown) {
    const url = new URL('https://mainnet.helius-rpc.com/');
    url.searchParams.set('api-key', config.apiKey);
    const result = await request(url.href, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ jsonrpc: '2.0', id: 'her-wallet', method, params }) });
    if (!object(result) || result.error || !('result' in result)) throw new Error('Helius RPC data is unavailable.');
    return result.result;
  }
  async function history(): Promise<WalletFeed> {
    const url = new URL(`https://api.helius.xyz/v1/wallet/${config.wallet}/history`);
    url.search = new URLSearchParams({ type: 'SWAP', tokenAccounts: 'none', limit: '20' }).toString();
    const { rows, historyTruncated } = historyRows(await request(url.href, { headers: { 'X-Api-Key': config.apiKey } }));
    const validRows = rows.filter(row => object(row) && typeof row.signature === 'string' && signaturePattern.test(row.signature));
    let statuses: unknown = [];
    if (validRows.length) {
      const result = await rpc('getSignatureStatuses', [validRows.map(row => (row as ObjectValue).signature), { searchTransactionHistory: true }]);
      if (!object(result)) throw new Error('Could not verify wallet transactions.');
      statuses = result.value;
    }
    return { enabled: true, wallet: config.wallet, observedAt: now(), readOnly: true, trades: normalizeSwaps(validRows, statuses, config.wallet), historyTruncated };
  }
  function cached<T>(key: string, ttl: number, work: () => Promise<T>): Promise<T> {
    const prior = cache.get(key);
    if (prior && prior.expires > now()) return prior.result as Promise<T>;
    const entry = { expires: now() + ttl, result: work() as Promise<unknown> };
    cache.set(key, entry);
    if (cache.size > 256) cache.delete(cache.keys().next().value!);
    entry.result.catch(() => { if (cache.get(key) === entry) cache.delete(key); });
    return entry.result as Promise<T>;
  }
  const feed = () => cached('feed', 10000, history);
  const metadata = (id: string) => {
    if (!addressPattern.test(id)) throw new Error('Invalid mint address.');
    return cached(`token:${id}`, 600000, async () => tokenDetails(await rpc('getAsset', { id, options: { showFungible: true } }), id));
  };
  const transaction = (signature: string) => {
    if (!signaturePattern.test(signature)) throw new Error('Invalid transaction signature.');
    return cached(`tx:${signature}`, 10000, () => rpc('getTransaction', [signature, { commitment: 'confirmed', encoding: 'json', maxSupportedTransactionVersion: 0 }]));
  };
  const tokenBalance = async (id: string) => {
    if (!addressPattern.test(id)) throw new Error('Invalid mint address.');
    const result = await rpc('getTokenAccountsByOwner', [config.wallet, { mint: id }, { encoding: 'jsonParsed', commitment: 'confirmed' }]);
    if (!object(result) || !Array.isArray(result.value) || result.value.length > 500) throw new Error('Token balance is unavailable.');
    return result.value.reduce((total: bigint, row: unknown) => {
      if (!object(row) || !object(row.account) || !object(row.account.data) || !object(row.account.data.parsed) || !object(row.account.data.parsed.info)) throw new Error('Token balance is unavailable.');
      const info = row.account.data.parsed.info;
      if (info.owner !== config.wallet || info.mint !== id || !object(info.tokenAmount) || typeof info.tokenAmount.amount !== 'string' || !/^\d{1,20}$/.test(info.tokenAmount.amount)) throw new Error('Token balance is unavailable.');
      return total + BigInt(info.tokenAmount.amount);
    }, 0n).toString();
  };
  const portfolio = () => cached('portfolio', 30000, async () => {
    const url = new URL(`https://api.helius.xyz/v1/wallet/${config.wallet}/balances`);
    url.search = new URLSearchParams({ limit: '20', showZeroBalance: 'false', showNfts: 'false', showNative: 'true' }).toString();
    const positions = normalizePositions(await request(url.href, { headers: { 'X-Api-Key': config.apiKey } }));
    return { ...await feed(), ...positions, holdingsObservedAt: now(), capability: 'Read-only confirmed wallet facts. This feed cannot sign or submit transactions.' };
  });
  return { feed, portfolio, metadata, transaction, tokenBalance };
}
