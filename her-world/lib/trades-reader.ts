import { PublicKey } from '@solana/web3.js';
import { assetDetails, buildTradesSnapshot, chainEvent, object, tokenHoldings, TOKEN_PROGRAMS, WSOL, type Asset, type ChainEvent } from './trades-accounting';

export function createTradesReader(wallet: string, apiKey: string, fetcher: typeof fetch = fetch, now = Date.now) {
  if (new PublicKey(wallet).toBase58() !== wallet || !apiKey) throw new Error('Wallet data is not configured.');
  let snapshot: { expires: number; promise: ReturnType<typeof read> } | undefined;
  let history: { expires: number; promise: Promise<{ events: ChainEvent[]; complete: boolean }> } | undefined;
  async function rpc(method: string, params: unknown) {
    const url = new URL('https://mainnet.helius-rpc.com/'); url.searchParams.set('api-key', apiKey);
    const response = await fetcher(url.href, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ jsonrpc: '2.0', id: 'her-public-trades', method, params }), cache: 'no-store', redirect: 'error', signal: AbortSignal.timeout(12000) });
    if (!response.ok) throw new Error('Wallet data is temporarily unavailable.');
    const raw = await response.text();
    if (raw.length > 12000000) throw new Error('Wallet data exceeds the response limit.');
    const result: unknown = JSON.parse(raw);
    if (!object(result) || result.error || !('result' in result)) throw new Error('Wallet data is temporarily unavailable.');
    return result.result;
  }
  async function readHistory() {
    const events: ChainEvent[] = [], cursors = new Set<string>();
    let cursor: string | undefined, complete = true;
    const start = now();
    // A bounded backfill prevents a public request from scanning an unlimited
    // wallet history. If incomplete, all-time/basis-dependent P&L stays null.
    for (let page = 0; page < 3; page++) {
      const result = await rpc('getTransactionsForAddress', [wallet, { transactionDetails: 'full', encoding: 'jsonParsed', maxSupportedTransactionVersion: 0, commitment: 'finalized', sortOrder: 'desc', limit: 1000, filters: { status: 'any', tokenAccounts: 'balanceChanged' }, ...(cursor ? { paginationToken: cursor } : {}) }]);
      if (!object(result) || !Array.isArray(result.data) || result.data.length > 1000 || (result.paginationToken !== null && result.paginationToken !== undefined && typeof result.paginationToken !== 'string')) throw new Error('Invalid wallet history.');
      for (const row of result.data) { const event = chainEvent(row, wallet); if (event) events.push(event); else complete = false; }
      if (!result.paginationToken) return { events, complete };
      if (cursors.has(result.paginationToken)) throw new Error('Wallet history cursor repeated.');
      cursors.add(result.paginationToken); cursor = result.paginationToken;
      if (now() - start > 30000) break;
    }
    return { events, complete: false };
  }
  function cachedHistory() {
    if (history && history.expires > now()) return history.promise;
    const entry = { expires: now() + 60000, promise: readHistory() }; history = entry;
    entry.promise.catch(() => { if (history === entry) history = undefined; });
    return entry.promise;
  }
  async function read() {
    const balance = await rpc('getBalance', [wallet, { commitment: 'finalized' }]);
    if (!object(balance) || !Number.isSafeInteger(balance.value) || Number(balance.value) < 0) throw new Error('Invalid SOL balance.');
    const holdings = [];
    for (const programId of TOKEN_PROGRAMS) holdings.push(...tokenHoldings(await rpc('getTokenAccountsByOwner', [wallet, { programId }, { encoding: 'jsonParsed', commitment: 'finalized' }]), wallet));
    const journal = await cachedHistory().catch(() => ({ events: [], complete: false }));
    const ids = [...new Set([WSOL, ...holdings.map(row => row.mint), ...journal.events.flatMap(row => row.changes.map(change => change.mint))])];
    if (ids.length > 1000) throw new Error('Wallet has too many assets for this dashboard.');
    const assets: Asset[] = [];
    for (let offset = 0; offset < ids.length; offset += 100) {
      const result = await rpc('getAssetBatch', { ids: ids.slice(offset, offset + 100), options: { showFungible: true } }).catch(() => []);
      if (!Array.isArray(result) || result.length > 100) continue;
      assets.push(...result.flatMap(row => { const asset = assetDetails(row); return asset && ids.includes(asset.mint) ? [asset] : []; }));
    }
    return buildTradesSnapshot({ wallet, solBalance: Number(balance.value) / 1e9, holdings, assets, events: journal.events, historyComplete: journal.complete, observedAt: now() });
  }
  function portfolio() {
    if (snapshot && snapshot.expires > now()) return snapshot.promise;
    const entry = { expires: now() + 60000, promise: read() }; snapshot = entry;
    entry.promise.catch(() => { if (snapshot === entry) snapshot = undefined; });
    return entry.promise;
  }
  return { portfolio };
}
