import { createHash } from 'node:crypto';
import bs58 from 'bs58';
import { emptyTrades, STARTING_SOL, type TradePosition } from './trades-types';

export const WSOL = 'So11111111111111111111111111111111111111112';
export const TOKEN_PROGRAMS = ['TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA', 'TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb'];
const SYSTEM = '11111111111111111111111111111111';
const standardPrograms = new Set([SYSTEM, ...TOKEN_PROGRAMS, 'ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL', 'ComputeBudget111111111111111111111111111111', 'MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr']);
// Swap-only discriminators from the official Jupiter and Pump IDLs. A pair
// of opposite transfers alone is not evidence that a swap took place.
const swapPrograms = new Map([
  ['JUP6LkbZbjS1jKKwapdHNy74zcZ3tLUZoi5QNyVTaV4', ['route', 'route_with_token_ledger', 'shared_accounts_route', 'shared_accounts_route_with_token_ledger', 'shared_accounts_exact_out_route']],
  ['6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P', ['buy', 'buy_exact_sol_in', 'buy_v2', 'buy_exact_quote_in_v2', 'sell', 'sell_v2']],
  ['pAMMBay6oceH9fJKBRHGP5D4bD4sWpmSwMn52FMfXEA', ['buy', 'buy_exact_quote_in', 'sell']],
].map(([program, names]) => [program, new Set((names as string[]).map(name => createHash('sha256').update(`global:${name}`).digest().subarray(0, 8).toString('hex')))] as const));
export const object = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object' && !Array.isArray(value);
const finite = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value);
const address = (value: unknown): value is string => typeof value === 'string' && /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(value);
const text = (value: unknown, max: number) => typeof value === 'string' ? value.replace(/[\u0000-\u001f\u007f]/g, ' ').trim().slice(0, max) : '';
export type Holding = { mint: string; amount: number };
export type Asset = { mint: string; name: string; symbol: string; logo: string | null; priceQuote: number | null; quoteCurrency: 'USD' | 'USDC' | null };
export type ChainEvent = { signature: string; timestamp: number; slot: number; index: number; changes: Holding[]; sol: number; fundingSol: number; unsupported: boolean; side: 'buy' | 'sell' | null };

export function logoUrl(value: unknown): string | null {
  if (typeof value !== 'string' || value.length > 2048) return null;
  const input = value.startsWith('ipfs://') ? `https://ipfs.io/ipfs/${value.slice(7).replace(/^ipfs\//, '')}` : value.startsWith('ar://') ? `https://arweave.net/${value.slice(5)}` : value;
  try {
    const url = new URL(input);
    if (url.protocol !== 'https:' || url.username || url.password || !url.hostname.includes('.') || /^(localhost|127\.|0\.|10\.|192\.168\.|169\.254\.|172\.(1[6-9]|2\d|3[01])\.)/.test(url.hostname) || /\.(local|internal)$/.test(url.hostname)) return null;
    return url.href;
  } catch { return null; }
}
export function assetDetails(value: unknown): Asset | null {
  if (!object(value) || !address(value.id) || !['FungibleToken', 'FungibleAsset'].includes(String(value.interface)) || !object(value.token_info)) return null;
  const content = object(value.content) ? value.content : {};
  const metadata = object(content.metadata) ? content.metadata : {};
  const links = object(content.links) ? content.links : {};
  const file = Array.isArray(content.files) ? content.files.find(row => object(row) && (String(row.mime || '').startsWith('image/') || logoUrl(row.cdn_uri))) : null;
  const price = object(value.token_info.price_info) ? value.token_info.price_info : {};
  return { mint: value.id, name: text(metadata.name, 80), symbol: text(value.token_info.symbol || metadata.symbol, 20),
    logo: logoUrl(links.image) || (object(file) ? logoUrl(file.cdn_uri) || logoUrl(file.uri) : null),
    quoteCurrency: price.currency === 'USD' || price.currency === 'USDC' ? price.currency : null,
    priceQuote: ['USD', 'USDC'].includes(String(price.currency)) && finite(price.price_per_token) && price.price_per_token > 0 ? price.price_per_token : null };
}
export function tokenHoldings(value: unknown, wallet: string): Holding[] {
  if (!object(value) || !Array.isArray(value.value) || value.value.length > 5000) throw new Error('Invalid token balances.');
  const amounts = new Map<string, { raw: bigint; decimals: number }>();
  for (const row of value.value) {
    if (!object(row) || !object(row.account) || !object(row.account.data) || !object(row.account.data.parsed) || !object(row.account.data.parsed.info)) throw new Error('Invalid token account.');
    const info = row.account.data.parsed.info, token = info.tokenAmount;
    if (info.owner !== wallet || !address(info.mint) || !object(token) || typeof token.amount !== 'string' || !/^\d{1,20}$/.test(token.amount) || !Number.isInteger(token.decimals) || Number(token.decimals) < 0 || Number(token.decimals) > 18) throw new Error('Invalid token amount.');
    const prior = amounts.get(info.mint);
    if (prior && prior.decimals !== token.decimals) throw new Error('Token decimals changed.');
    amounts.set(info.mint, { raw: (prior?.raw || 0n) + BigInt(token.amount), decimals: Number(token.decimals) });
  }
  return [...amounts].map(([mint, value]) => ({ mint, amount: Number(value.raw) / 10 ** value.decimals })).filter(row => row.amount > 0);
}

export function chainEvent(value: unknown, wallet: string): ChainEvent | null {
  if (!object(value) || !object(value.meta) || !object(value.transaction) || !object(value.transaction.message) || !Number.isSafeInteger(value.blockTime) || Number(value.blockTime) <= 0) return null;
  const meta = value.meta, tx = value.transaction, message = tx.message as Record<string, unknown>;
  if (!Array.isArray(tx.signatures) || typeof tx.signatures[0] !== 'string' || !/^[1-9A-HJ-NP-Za-km-z]{80,90}$/.test(tx.signatures[0]) || !Array.isArray(message.accountKeys) || !Array.isArray(meta.preBalances) || !Array.isArray(meta.postBalances) || !Array.isArray(meta.preTokenBalances) || !Array.isArray(meta.postTokenBalances)) return null;
  const keys = message.accountKeys.map(key => typeof key === 'string' ? key : object(key) ? key.pubkey : null);
  if (object(meta.loadedAddresses)) keys.push(...[meta.loadedAddresses.writable, meta.loadedAddresses.readonly].flatMap(rows => Array.isArray(rows) ? rows : []));
  const walletIndex = keys.indexOf(wallet);
  if (walletIndex >= 0 && (!Number.isSafeInteger(meta.preBalances[walletIndex]) || !Number.isSafeInteger(meta.postBalances[walletIndex]))) return null;
  const nativeSol = walletIndex < 0 ? 0 : (Number(meta.postBalances[walletIndex]) - Number(meta.preBalances[walletIndex])) / 1e9;
  const base = { signature: tx.signatures[0], timestamp: Number(value.blockTime) * 1000, slot: Number(value.slot) || 0, index: Number(value.transactionIndex) || 0 };
  if (meta.err !== null) return { ...base, sol: nativeSol, fundingSol: 0, changes: [], side: null, unsupported: false };
  const deltas = new Map<string, { raw: bigint; decimals: number }>();
  const owned = new Set<string>([wallet]);
  for (const [rows, sign] of [[meta.preTokenBalances, -1n], [meta.postTokenBalances, 1n]] as const) {
    for (const row of rows as unknown[]) {
      if (!object(row) || row.owner !== wallet) continue;
      const token = row.uiTokenAmount;
      if (!address(row.mint) || !object(token) || typeof token.amount !== 'string' || !/^\d{1,20}$/.test(token.amount) || !Number.isInteger(token.decimals) || Number(token.decimals) < 0 || Number(token.decimals) > 18) return null;
      const prior = deltas.get(row.mint);
      if (prior && prior.decimals !== token.decimals) return null;
      deltas.set(row.mint, { raw: (prior?.raw || 0n) + BigInt(token.amount) * sign, decimals: Number(token.decimals) });
      if (typeof row.accountIndex === 'number' && typeof keys[row.accountIndex] === 'string') owned.add(keys[row.accountIndex] as string);
    }
  }
  const changes = [...deltas].map(([mint, value]) => ({ mint, amount: Number(value.raw) / 10 ** value.decimals })).filter(row => row.amount !== 0);
  const sol = nativeSol + (changes.find(row => row.mint === WSOL)?.amount || 0);
  const coins = changes.filter(row => row.mint !== WSOL);
  const instructions = [...(Array.isArray(message.instructions) ? message.instructions : []), ...(Array.isArray(meta.innerInstructions) ? meta.innerInstructions.flatMap(row => object(row) && Array.isArray(row.instructions) ? row.instructions : []) : [])].filter(object);
  const program = (row: Record<string, unknown>) => typeof row.programId === 'string' ? row.programId : typeof row.programIdIndex === 'number' ? keys[row.programIdIndex] : null;
  const swap = instructions.some(row => {
    const id = program(row), allowed = typeof id === 'string' ? swapPrograms.get(id) : null;
    if (!allowed || typeof row.data !== 'string') return false;
    try { return allowed.has(Buffer.from(bs58.decode(row.data)).subarray(0, 8).toString('hex')); } catch { return false; }
  });
  const side = swap && coins.length === 1 ? coins[0].amount > 0 && sol < 0 ? 'buy' : coins[0].amount < 0 && sol > 0 ? 'sell' : null : null;
  let fundingSol = 0;
  if (!swap) for (const row of instructions) {
    if (program(row) !== SYSTEM || !object(row.parsed) || !['transfer', 'transferWithSeed'].includes(String(row.parsed.type)) || !object(row.parsed.info)) continue;
    const info = row.parsed.info;
    if (!Number.isSafeInteger(info.lamports) || Number(info.lamports) < 0) continue;
    if (info.destination === wallet && typeof info.source === 'string' && !owned.has(info.source)) fundingSol += Number(info.lamports) / 1e9;
    if (info.source === wallet && typeof info.destination === 'string' && !owned.has(info.destination)) fundingSol -= Number(info.lamports) / 1e9;
  }
  const unsupported = swap ? !side : coins.length > 0 || instructions.some(row => { const id = program(row); return typeof id === 'string' && !standardPrograms.has(id); }) && Math.abs(sol) > 0.000001;
  return { ...base, sol, fundingSol: unsupported ? 0 : fundingSol, changes: coins, side, unsupported };
}

export function buildTradesSnapshot(input: { wallet: string; solBalance: number; holdings: Holding[]; assets: Asset[]; events: ChainEvent[]; historyComplete: boolean; observedAt: number }) {
  const { wallet, holdings, historyComplete } = input;
  const assets = new Map(input.assets.map(asset => [asset.mint, asset]));
  const solPriceQuote = assets.get(WSOL)?.priceQuote || null;
  const quoteCurrency = assets.get(WSOL)?.quoteCurrency || null;
  const balances = new Map(holdings.map(row => [row.mint, row.amount]));
  const books = new Map<string, { amount: number; cost: number; boughtSol: number; realized: number; known: boolean; bought: boolean }>();
  const seen = new Set<string>();
  const events = input.events.filter(row => { if (seen.has(row.signature)) return false; seen.add(row.signature); return true; }).sort((a, b) => a.slot - b.slot || a.index - b.index || a.timestamp - b.timestamp);
  let funding = 0, deposits = 0, unsupported = false;
  for (const event of events) {
    funding += event.fundingSol;
    deposits += Math.max(0, event.fundingSol);
    unsupported ||= event.unsupported;
    for (const change of event.changes) {
      const book = books.get(change.mint) || { amount: 0, cost: 0, boughtSol: 0, realized: 0, known: historyComplete, bought: false };
      if (event.side === 'buy') { book.cost += -event.sol; book.boughtSol += -event.sol; book.bought = true; }
      else if (event.side === 'sell') {
        if (book.amount <= 0 || -change.amount > book.amount + Math.max(1e-9, book.amount * 1e-8)) book.known = false;
        const removedCost = book.amount > 0 ? book.cost * Math.min(1, -change.amount / book.amount) : 0;
        book.cost -= removedCost; book.realized += event.sol - removedCost;
      } else book.known = false;
      book.amount = Math.max(0, book.amount + change.amount);
      if (book.amount < 1e-12) { book.amount = 0; book.cost = 0; }
      books.set(change.mint, book);
    }
  }
  const ids = new Set([...balances.keys(), ...books.keys()]); ids.delete(WSOL);
  const positions: TradePosition[] = [...ids].map(mint => {
    const amount = balances.get(mint) || 0, asset = assets.get(mint), book = books.get(mint);
    const known = !!book?.known && Math.abs(book.amount - amount) <= Math.max(1e-8, amount * 1e-6);
    const valueSol = amount === 0 ? 0 : asset?.priceQuote && solPriceQuote && asset.quoteCurrency === quoteCurrency ? amount * asset.priceQuote / solPriceQuote : null;
    const realizedSol = known ? book.realized : null;
    const unrealizedSol = known && valueSol !== null ? valueSol - book.cost : null;
    const pnlSol = realizedSol !== null && unrealizedSol !== null ? realizedSol + unrealizedSol : null;
    return { mint, name: asset?.name || '', symbol: asset?.symbol || '', logo: asset?.logo || null, amount, bought: book?.bought || false,
      priceQuote: asset?.priceQuote || null, valueSol, costSol: known ? book.cost : null, realizedSol, unrealizedSol, pnlSol,
      pnlPercent: pnlSol !== null && book && book.boughtSol > 0 ? pnlSol / book.boughtSol * 100 : null, boughtSol: book?.boughtSol || 0 };
  }).filter(row => row.amount > 0 || row.bought).sort((a, b) => Number(b.amount > 0) - Number(a.amount > 0) || (b.valueSol || 0) - (a.valueSol || 0));
  const wrappedSolBalance = balances.get(WSOL) || 0;
  const pricesComplete = positions.every(row => row.valueSol !== null);
  const equitySol = pricesComplete ? input.solBalance + wrappedSolBalance + positions.reduce((sum, row) => sum + (row.valueSol || 0), 0) : null;
  const fundingComplete = deposits + 1e-8 >= STARTING_SOL;
  const adjustedCapital = STARTING_SOL + funding - Math.min(STARTING_SOL, deposits);
  const pnlSol = equitySol !== null && historyComplete && !unsupported && fundingComplete ? equitySol - adjustedCapital : null;
  const basisComplete = historyComplete && positions.every(row => row.realizedSol !== null);
  const realizedSol = basisComplete ? positions.reduce((sum, row) => sum + (row.realizedSol || 0), 0) : null;
  const unrealizedSol = basisComplete && pricesComplete ? positions.reduce((sum, row) => sum + (row.unrealizedSol || 0), 0) : null;
  const activity = [...events].reverse().flatMap(event => {
    if (!event.side || event.changes.length !== 1) return [];
    const change = event.changes[0], asset = assets.get(change.mint);
    return [{ signature: event.signature, timestamp: event.timestamp, mint: change.mint, side: event.side, amount: Math.abs(change.amount), solAmount: Math.abs(event.sol), name: asset?.name || '', symbol: asset?.symbol || '', logo: asset?.logo || null }];
  });
  const warnings = [!historyComplete && 'history_incomplete', !pricesComplete && 'prices_missing', !basisComplete && 'basis_missing', unsupported && 'unsupported_activity', !fundingComplete && 'funding_pending'].filter(Boolean) as ReturnType<typeof emptyTrades>['warnings'];
  return { ...emptyTrades('live'), wallet, observedAt: input.observedAt, solBalance: input.solBalance, wrappedSolBalance, solPriceQuote, quoteCurrency, equitySol,
    equityQuote: equitySol !== null && solPriceQuote ? equitySol * solPriceQuote : null, pnlSol, pnlPercent: pnlSol === null ? null : pnlSol / STARTING_SOL * 100,
    realizedSol, unrealizedSol, positions, activity, warnings };
}
