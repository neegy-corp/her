import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createWalletReader, historyRows, normalizePositions, normalizeSwaps, tokenDetails, walletAuthorized } from '../lib/wallet-reader.ts';
import { orderReceipt } from '../lib/operator-receipt.ts';
const wallet = '1'.repeat(32), coin = '2'.repeat(32), signature = '3'.repeat(88);
const row = { signature, timestamp: 1700000000, error: null, feePayer: wallet, balanceChanges: [{ mint: 'SOL', amount: -0.1 }, { mint: coin, amount: 100 }] };
const status = { err: null, confirmationStatus: 'confirmed' };
test('only successful confirmed swaps are reported and transfers/failures are skipped', () => {
  assert.equal(normalizeSwaps([row], [status], wallet)[0].side, 'buy');
  for (const bad of [{ ...status, err: {} }, { ...status, confirmationStatus: 'processed' }, null]) assert.deepEqual(normalizeSwaps([row], [bad], wallet), []);
  for (const bad of [{ ...row, type: 'TRANSFER' }, { ...row, error: {} }, { ...row, timestamp: null }, { ...row, feePayer: 'other' }, { ...row, balanceChanges: [{ mint: coin, amount: 2 }] }]) assert.deepEqual(normalizeSwaps([bad], [status], wallet), []);
  assert.equal(normalizeSwaps([row, row], [status, status], wallet).length, 1);
  assert.throws(() => normalizeSwaps([row], [], wallet));
  const sell = { ...row, balanceChanges: [{ mint: 'SOL', amount: 0.1 }, { mint: coin, amount: -100 }] };
  assert.equal(normalizeSwaps([sell], [status], wallet)[0].side, 'sell');
});
test('holdings expose bounded indicative marks, never invented PnL', () => {
  const positions = normalizePositions({ balances: [{ mint: coin, balance: 2, name: 'Test coin', symbol: 'TEST', pricePerToken: 3 }, { mint: coin, balance: -1 }, { mint: wallet, balance: 1, pricePerToken: null }], pagination: { hasMore: true } });
  assert.equal(positions.positions[0].valueUsd, 6); assert.equal(positions.positions[1].priceUsd, null);
  assert.equal(positions.pnl, null); assert.equal(positions.holdingsTruncated, true); assert.match(positions.pricing, /hourly/);
  assert.throws(() => normalizePositions({ balances: [] })); assert.throws(() => historyRows({ data: [] }));
  assert.equal(tokenDetails({ id: coin, interface: 'FungibleToken', token_info: { decimals: 6 }, content: { metadata: { name: 'Coin', symbol: 'TEST' } } }, coin).symbol, 'TEST');
  assert.throws(() => tokenDetails({ id: coin, interface: 'V1_NFT', token_info: { decimals: 0 } }, coin));
});
test('reader authenticates fixed Helius endpoints, caches, confirms and retries failures', async () => {
  let calls = 0, now = 1700000000100, fail = false;
  const mock = async (url, init) => {
    calls++;
    const parsed = new URL(url);
    assert.ok(['api.helius.xyz', 'mainnet.helius-rpc.com'].includes(parsed.hostname));
    assert.equal(init.redirect, 'error');
    if (fail) return new Response('', { status: 503 });
    if (parsed.pathname.endsWith('/history')) { assert.equal(init.headers['X-Api-Key'], 'test-key'); assert.equal(parsed.searchParams.get('type'), 'SWAP'); return Response.json({ data: [row], pagination: { hasMore: false } }); }
    if (parsed.pathname.endsWith('/balances')) return Response.json({ balances: [{ mint: coin, balance: 100 }], pagination: { hasMore: false } });
    return Response.json({ result: { value: [status] } });
  };
  const reader = createWalletReader({ wallet, apiKey: 'test-key' }, mock, () => now);
  assert.equal((await reader.feed()).trades.length, 1); await reader.feed(); assert.equal(calls, 2);
  assert.equal((await reader.portfolio()).positions.length, 1); assert.equal(calls, 3);
  now += 11000; fail = true; await assert.rejects(reader.feed());
  fail = false; assert.equal((await reader.feed()).trades.length, 1);
});
test('read token is required independently from operator authentication', () => {
  assert.equal(walletAuthorized(new Request('https://example.com'), 'a'.repeat(32)), false);
  assert.equal(walletAuthorized(new Request('https://example.com', { headers: { Authorization: `Bearer ${'a'.repeat(32)}` } }), 'a'.repeat(32)), true);
  assert.equal(walletAuthorized(new Request('https://example.com', { headers: { Authorization: 'Bearer short' } }), 'short'), false);
});
test('known-order fallback verifies successful chain deltas, wallet, signature and side', () => {
  const order = { signature, mint: coin, side: 'buy' };
  const receipt = { blockTime: 1700000000, transaction: { signatures: [signature], message: { accountKeys: [wallet] } }, meta: { err: null, preBalances: [1000000000], postBalances: [899995000], preTokenBalances: [], postTokenBalances: [{ owner: wallet, mint: coin, uiTokenAmount: { amount: '2000000', decimals: 6 } }] } };
  assert.equal(orderReceipt(receipt, wallet, order).changes[1].amount, 2);
  assert.equal(orderReceipt({ ...receipt, meta: { ...receipt.meta, err: {} } }, wallet, order), null);
  assert.equal(orderReceipt(receipt, 'other', order), null);
  assert.equal(orderReceipt(receipt, wallet, { ...order, signature: '4'.repeat(88) }), null);
  assert.equal(orderReceipt(receipt, wallet, { ...order, side: 'sell' }), null);
});
