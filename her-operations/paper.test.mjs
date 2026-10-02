import { test } from 'node:test';
import assert from 'node:assert/strict';
import { SOL, config, lamports, candidates, initialState, tick } from './paper-engine.mjs';
import { market } from './paper-market.mjs';
const time = Date.parse('2026-10-02T12:00:00Z');
const mint = 'G6VTWhrErdU59EaGFpiy3vugSG1UUjrDuaYZ33Kjpump';
const settings = { mode: 'paper', tradeSol: '0.05', dailyLossSol: '0.15', virtualCapitalSol: '3' };
const pair = () => ({ chainId: 'solana', dexId: 'pumpswap', baseToken: { address: mint, symbol: 'TEST' }, pairCreatedAt: time - 3_600_000, priceChange: { m5: 3, h1: 10 }, liquidity: { usd: 100_000 }, volume: { m5: 6000 }, txns: { m5: { buys: 20, sells: 10 } } });
function provider(out = '50000000', now = time) {
  return { discover: async () => [pair()], quote: async input => ({ outAmount: input === SOL ? '1000000' : out, at: now }) };
}
test('configuration is paper-only, uses exact decimals and requires explicit limits', () => {
  assert.equal(lamports('0.5'), 500000000n);
  assert.equal(lamports('0.000000001'), 1n);
  for (const value of ['0', '-1', 'NaN', '1e-3', '0.0000000001']) assert.throws(() => lamports(value));
  assert.throws(() => config({ ...settings, mode: 'live' }));
  assert.throws(() => config({ mode: 'paper' }));
});
test('screen rejects malformed, thin, hyped, young and excluded pools and deduplicates', () => {
  assert.equal(candidates([pair(), pair()], time).length, 1);
  assert.equal(candidates([pair()], time, new Set([mint])).length, 0);
  for (const change of [{ chainId: 'ethereum' }, { dexId: 'raydium' }, { liquidity: { usd: 1 } }, { pairCreatedAt: time }, { priceChange: { m5: 99, h1: 100 } }, { txns: { m5: { buys: NaN, sells: 1 } } }]) assert.equal(candidates([{ ...pair(), ...change }], time).length, 0);
});
test('paper entry requires both routes and cannot duplicate across persisted ticks', async () => {
  const first = await tick(initialState(settings, time), settings, provider(), time);
  assert.equal(first.position.units, '990000');
  assert.equal(first.cash, '2949990000');
  assert.equal(first.events[0].simulated, true);
  const resumed = await tick(JSON.parse(JSON.stringify(first)), settings, provider('50000000', time + 60_000), time + 60_000);
  assert.equal(resumed.events.length, 1);
  assert.ok(resumed.position);
});
test('missing reverse route and stale quotes do not produce simulated fills', async () => {
  const p = provider(); p.quote = async input => { if (input !== SOL) throw new Error('no route'); return { outAmount: '1000000', at: time }; };
  assert.equal((await tick(initialState(settings, time), settings, p, time)).position, null);
  assert.equal((await tick(initialState(settings, time), settings, provider('50000000', time - 60_000), time)).position, null);
});
test('quote latency is measured against provider clock, not start of a slow tick', async () => {
  const p = provider('50000000', time + 5000); p.now = () => time + 5000;
  assert.ok((await tick(initialState(settings, time), settings, p, time)).position);
});
test('missing exit quote preserves position with unknown equity and blocks new entries', async () => {
  const first = await tick(initialState(settings, time), settings, provider(), time);
  const p = provider(); p.quote = async () => { throw new Error('offline'); };
  const second = await tick(first, settings, p, time + 60_000);
  assert.equal(second.position.mint, mint);
  assert.equal(second.equity, null);
  assert.equal(second.status, 'paused-unpriced-position');
  assert.equal(second.events.length, 1);
});
test('stop-loss uses quoted exit after slippage/fee and enforces cooldown', async () => {
  const first = await tick(initialState(settings, time), settings, provider(), time);
  const second = await tick(first, settings, provider('40000000', time + 60_000), time + 60_000);
  assert.equal(second.position, null);
  assert.equal(second.events[1].reason, 'stop-loss-10-percent');
  assert.equal(second.events[1].pnl, '-10420000');
  const next = await tick(second, settings, provider('50000000', time + 120_000), time + 120_000);
  assert.equal(next.status, 'cooldown');
});
test('daily loss includes open-position loss and remains latched after recovery', async () => {
  const c = { ...settings, dailyLossSol: '0.01' };
  const first = await tick(initialState(c, time), c, provider(), time);
  const second = await tick(first, c, provider('39000000', time + 60_000), time + 60_000);
  assert.equal(second.status, 'daily-loss-limit-reached');
  assert.equal(second.position, null);
  assert.equal(second.halted, true);
  assert.equal((await tick(second, c, provider('50000000', time + 600_000), time + 600_000)).position, null);
});
test('UTC day reset is persisted, and changing limits cannot silently reset history', async () => {
  const first = initialState(settings, time); first.halted = true;
  const nextDay = time + 86400_000;
  const p = provider('50000000', nextDay); p.discover = async () => [];
  const next = await tick(first, settings, p, nextDay);
  assert.equal(next.day, '2026-10-03'); assert.equal(next.halted, false);
  assert.equal(next.events[0].type, 'day-baseline');
  await assert.rejects(tick(next, { ...settings, tradeSol: '0.5' }, p, nextDay), /mismatch/);
});
test('take profit and maximum holding duration simulate separate exits', async () => {
  const first = await tick(initialState(settings, time), settings, provider(), time);
  assert.equal((await tick(first, settings, provider('65000000', time + 60_000), time + 60_000)).events[1].reason, 'take-profit-20-percent');
  assert.equal((await tick(first, settings, provider('50000000', time + 1800_000), time + 1800_000)).events[1].reason, 'maximum-hold-30-minutes');
});
test('market adapter requests quotes without wallets and never follows redirects or submits transactions', async () => {
  const calls = [];
  const fetcher = async (url, options) => {
    const u = new URL(url); calls.push({ u, options });
    if (u.hostname === 'api.dexscreener.com') return new Response(JSON.stringify({ pairs: [pair()] }));
    assert.equal(u.hostname, 'api.jup.ag'); assert.equal(u.pathname, '/swap/v2/order');
    assert.equal(u.searchParams.has('taker'), false); assert.equal(u.searchParams.has('payer'), false);
    return new Response(JSON.stringify({ inputMint: SOL, outputMint: mint, inAmount: '50000000', outAmount: '1000000', transaction: null }));
  };
  const p = market('synthetic-key', [], fetcher);
  await p.discover(); await p.quote(SOL, mint, '50000000');
  for (const call of calls) { assert.equal(call.options.method, 'GET'); assert.equal(call.options.redirect, 'error'); }
  assert.equal(calls[0].options.headers['x-api-key'], undefined);
  assert.equal(calls[2].options.headers['x-api-key'], 'synthetic-key');
  const bad = market('synthetic-key', [], async () => new Response(JSON.stringify({ inputMint: SOL, outputMint: mint, inAmount: '50000000', outAmount: '1000000', transaction: 'unexpected' })));
  await assert.rejects(bad.quote(SOL, mint, '50000000'));
});
