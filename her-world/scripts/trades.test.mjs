import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createHash } from 'node:crypto';
import bs58 from 'bs58';
import { Keypair } from '@solana/web3.js';
import { registerHooks } from 'node:module';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
const root = new URL('../', import.meta.url);
registerHooks({ resolve(specifier, context, next) {
  if (specifier.startsWith('@/')) specifier = new URL(specifier.slice(2), root).href;
  if ((specifier.startsWith('.') || specifier.startsWith('file:')) && context.parentURL?.startsWith(root.href)) {
    const target = new URL(specifier, context.parentURL);
    if (!target.pathname.endsWith('.ts') && existsSync(fileURLToPath(`${target.href}.ts`))) specifier = `${target.href}.ts`;
  }
  return next(specifier, context);
} });
const { assetDetails, buildTradesSnapshot, chainEvent, logoUrl, tokenHoldings, WSOL, TOKEN_PROGRAMS } = await import('../lib/trades-accounting.ts');
const { createTradesReader } = await import('../lib/trades-reader.ts');
const { emptyTrades } = await import('../lib/trades-types.ts');
const route = await import('../app/api/trades/route.ts');

const wallet = Keypair.generate().publicKey.toBase58(), coin = Keypair.generate().publicKey.toBase58();
const tokenAccount = Keypair.generate().publicKey.toBase58(), source = Keypair.generate().publicKey.toBase58();
const JUPITER = 'JUP6LkbZbjS1jKKwapdHNy74zcZ3tLUZoi5QNyVTaV4';
const signature = n => bs58.encode(new Uint8Array(64).fill(n));
const instruction = { programId: JUPITER, data: bs58.encode(createHash('sha256').update('global:route').digest().subarray(0, 8)) };
const token = (amount, id = coin) => ({ owner: wallet, mint: id, accountIndex: 1, uiTokenAmount: { amount: String(Math.round(amount * 1e6)), decimals: 6 } });
function transaction(n, sol, before, after, instructions = [instruction]) {
  return { blockTime: 1700000000 + n, slot: n, transactionIndex: 0, transaction: { signatures: [signature(n)], message: { accountKeys: [{ pubkey: wallet }, { pubkey: tokenAccount }], instructions } }, meta: { err: null, fee: 5000, preBalances: [10000000000, 2000000], postBalances: [10000000000 + Math.round(sol * 1e9), 2000000], preTokenBalances: before ? [token(before)] : [], postTokenBalances: after ? [token(after)] : [], innerInstructions: [] } };
}
function funding(n, sol) {
  return transaction(n, sol, 0, 0, [{ programId: '11111111111111111111111111111111', parsed: { type: 'transfer', info: { source: sol > 0 ? source : wallet, destination: sol > 0 ? wallet : source, lamports: Math.round(Math.abs(sol) * 1e9) } } }]);
}
const events = () => [funding(1, 3), transaction(2, -1, 0, 100), transaction(3, 0.6, 100, 60)].map(row => chainEvent(row, wallet));
const assets = [{ mint: WSOL, name: 'Solana', symbol: 'SOL', priceQuote: 100, quoteCurrency: 'USDC', logo: null }, { mint: coin, name: 'Test coin', symbol: 'TEST', priceQuote: 2, quoteCurrency: 'USDC', logo: 'https://example.com/coin.png' }];
const input = () => ({ wallet, solBalance: 2.6, holdings: [{ mint: coin, amount: 60 }], assets, events: events(), historyComplete: true, observedAt: 1700000004000 });
const near = (actual, expected) => assert.ok(Math.abs(actual - expected) < 1e-8, `${actual} ~= ${expected}`);

test('confirmed gTFA transactions identify actual swap instructions, not coincident transfers', () => {
  assert.equal(chainEvent(transaction(2, -1, 0, 100), wallet).side, 'buy');
  assert.equal(chainEvent(transaction(3, 0.6, 100, 60), wallet).side, 'sell');
  const transfer = chainEvent(transaction(2, -1, 0, 100, []), wallet);
  assert.equal(transfer.side, null); assert.equal(transfer.unsupported, true);
  const failed = transaction(2, -1, 0, 100); failed.meta.err = { InstructionError: [0, 'failed'] };
  assert.equal(chainEvent(failed, wallet).side, null);
  assert.deepEqual(chainEvent(failed, wallet).changes, []);
  assert.equal(chainEvent({ ...failed, blockTime: null }, wallet), null);
  const inner = transaction(2, -1, 0, 100, []); inner.meta.innerInstructions = [{ instructions: [instruction] }];
  assert.equal(chainEvent(inner, wallet).side, 'buy');
});
test('average cost handles partial exits, realizes sold cost only, and marks open holdings', () => {
  const value = buildTradesSnapshot(input()), position = value.positions[0];
  near(value.equitySol, 3.8); near(value.pnlSol, 0.8); near(value.pnlPercent, 0.8 / 3 * 100);
  near(position.costSol, 0.6); near(position.realizedSol, 0.2); near(position.unrealizedSol, 0.6); near(position.pnlSol, 0.8);
  near(value.realizedSol, 0.2); near(value.unrealizedSol, 0.6);
  assert.equal(value.activity[0].side, 'sell'); assert.equal(value.activity[1].symbol, 'TEST');
  assert.equal(value.activity[0].logo, 'https://example.com/coin.png');
  const duplicate = buildTradesSnapshot({ ...input(), events: [...events(), events()[1]] });
  assert.deepEqual(duplicate, value);
});
test('additional funding and withdrawals are not trading profits or losses', () => {
  const topped = buildTradesSnapshot({ ...input(), solBalance: 3.6, events: [...events(), chainEvent(funding(4, 1), wallet)] });
  near(topped.equitySol, 4.8); near(topped.pnlSol, 0.8);
  const withdrawn = buildTradesSnapshot({ ...input(), solBalance: 3.1, events: [...events(), chainEvent(funding(4, 1), wallet), chainEvent(funding(5, -0.5), wallet)] });
  near(withdrawn.pnlSol, 0.8);
});
test('closed coins preserve realized PnL and metadata even without a current token account', () => {
  const closed = buildTradesSnapshot({ ...input(), solBalance: 3.8, holdings: [], events: [...events(), chainEvent(transaction(4, 1.2, 60, 0), wallet)] });
  assert.equal(closed.positions[0].amount, 0); assert.equal(closed.positions[0].symbol, 'TEST');
  near(closed.positions[0].realizedSol, 0.8); near(closed.positions[0].pnlSol, 0.8); near(closed.pnlSol, 0.8);
});
test('partial history, unmatched holdings, transfers and missing prices never manufacture PnL', () => {
  const partial = buildTradesSnapshot({ ...input(), historyComplete: false });
  assert.equal(partial.pnlSol, null); assert.equal(partial.positions[0].pnlSol, null); assert.equal(partial.realizedSol, null);
  const mismatch = buildTradesSnapshot({ ...input(), holdings: [{ mint: coin, amount: 70 }] });
  assert.equal(mismatch.positions[0].pnlSol, null); assert.ok(mismatch.warnings.includes('basis_missing'));
  const transferred = buildTradesSnapshot({ ...input(), holdings: [{ mint: coin, amount: 70 }], events: [...events(), chainEvent(transaction(4, 0, 60, 70, []), wallet)] });
  assert.equal(transferred.pnlSol, null); assert.equal(transferred.positions[0].pnlSol, null);
  const unpriced = buildTradesSnapshot({ ...input(), assets: [assets[0], { ...assets[1], priceQuote: null }] });
  assert.equal(unpriced.equitySol, null); assert.equal(unpriced.pnlSol, null); assert.equal(unpriced.positions[0].valueSol, null);
  const differentCurrency = buildTradesSnapshot({ ...input(), assets: [assets[0], { ...assets[1], quoteCurrency: 'USD' }] });
  assert.equal(differentCurrency.equitySol, null);
  const unfunded = buildTradesSnapshot({ ...input(), events: events().slice(1) });
  assert.equal(unfunded.pnlSol, null); assert.ok(unfunded.warnings.includes('funding_pending'));
});
test('DAS metadata preserves real mark currency and only accepts safe image URLs', () => {
  const parsed = assetDetails({ id: coin, interface: 'FungibleToken', content: { metadata: { name: 'Coin', symbol: 'TEST' }, links: { image: 'ipfs://some-cid/logo.png' } }, token_info: { price_info: { price_per_token: 2, currency: 'USDC' } } });
  assert.equal(parsed.logo, 'https://ipfs.io/ipfs/some-cid/logo.png'); assert.equal(parsed.priceQuote, 2); assert.equal(parsed.quoteCurrency, 'USDC');
  for (const url of ['javascript:alert(1)', 'data:image/svg+xml,stuff', 'http://example.com/a.png', 'https://localhost/a.png', 'https://127.0.0.1/a.png', 'https://user:password@example.com/a.png']) assert.equal(logoUrl(url), null);
  assert.equal(assetDetails({ id: coin, interface: 'V1_NFT', token_info: {} }), null);
});
test('token accounts are aggregated with raw integers, including Token-2022', () => {
  const row = raw => ({ account: { data: { parsed: { info: { owner: wallet, mint: coin, tokenAmount: { amount: raw, decimals: 6 } } } } } });
  assert.deepEqual(tokenHoldings({ value: [row('1000000'), row('2000000')] }, wallet), [{ mint: coin, amount: 3 }]);
  assert.throws(() => tokenHoldings({ value: [row('-1')] }, wallet));
});
test('reader paginates gTFA, includes both token programs, caches, and withholds PnL on failed history', async () => {
  let calls = [], now = 1700000004000, failHistory = false;
  const mock = async (url, init) => {
    assert.equal(new URL(url).hostname, 'mainnet.helius-rpc.com'); assert.equal(init.redirect, 'error');
    const body = JSON.parse(init.body); calls.push(body);
    if (body.method === 'getBalance') return Response.json({ result: { value: 2600000000 } });
    if (body.method === 'getTokenAccountsByOwner') return Response.json({ result: { value: body.params[1].programId === TOKEN_PROGRAMS[0] ? [{ account: { data: { parsed: { info: { owner: wallet, mint: coin, tokenAmount: { amount: '60000000', decimals: 6 } } } } } }] : [] } });
    if (body.method === 'getTransactionsForAddress') {
      if (failHistory) return Response.json({ error: { code: -32000, message: 'Provider failure' } });
      assert.equal(body.params[1].commitment, 'finalized'); assert.equal(body.params[1].filters.tokenAccounts, 'balanceChanged');
      return Response.json({ result: body.params[1].paginationToken ? { data: [funding(1, 3)], paginationToken: null } : { data: [transaction(3, 0.6, 100, 60), transaction(2, -1, 0, 100)], paginationToken: '1:0' } });
    }
    assert.equal(body.method, 'getAssetBatch');
    return Response.json({ result: assets.map(asset => ({ id: asset.mint, interface: 'FungibleToken', content: { metadata: { name: asset.name, symbol: asset.symbol }, links: { image: asset.logo } }, token_info: { price_info: { price_per_token: asset.priceQuote, currency: asset.quoteCurrency } } })) });
  };
  const reader = createTradesReader(wallet, 'mock-key', mock, () => now);
  near((await reader.portfolio()).pnlSol, 0.8); const count = calls.length; await reader.portfolio(); assert.equal(calls.length, count);
  assert.equal(calls.filter(row => row.method === 'getTransactionsForAddress').length, 2);
  assert.equal(calls.filter(row => row.method === 'getTokenAccountsByOwner').length, 2);
  now += 61000; failHistory = true;
  const partial = await reader.portfolio(); assert.equal(partial.pnlSol, null); near(partial.solBalance, 2.6);
});
test('public API remains read-only and reveals no private configuration when disabled', async () => {
  const prior = { ...process.env }, original = globalThis.fetch;
  Object.assign(process.env, { HER_WALLET_TRACKING_ENABLED: 'false', HER_OPERATOR_PATH_KEY: 'private-path', HER_OPERATOR_SESSION_SECRET: 'private-session', HER_WALLET_READ_TOKEN: 'private-read-token', HER_WALLET_PRIVATE_KEY: 'private-wallet-key' });
  globalThis.fetch = async () => { throw new Error('Disabled endpoint must not call any provider'); };
  try {
    const response = await route.GET(); assert.equal(response.status, 200);
    const body = await response.json(); assert.deepEqual(body, emptyTrades('paused')); assert.equal(body.startingSol, 3);
    assert.doesNotMatch(JSON.stringify(body), /private-|operator|helius|jupiter/i);
  } finally { globalThis.fetch = original; for (const key of Object.keys(process.env)) if (!(key in prior)) delete process.env[key]; Object.assign(process.env, prior); }
});
