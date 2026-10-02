import assert from 'node:assert/strict';
import { test } from 'node:test';
import { WalletAnnouncements, walletAnnouncement, walletFeed } from '../lib/wallet-updates.ts';
import { TurnGate } from '../lib/her-turns.ts';
const wallet = '1'.repeat(32), coin = '2'.repeat(32), signature = '3'.repeat(88), start = 1700000000000;
const trade = { signature, timestamp: start + 1000, confirmation: 'confirmed', side: 'buy', changes: [{ mint: 'SOL', amount: -1 }, { mint: coin, amount: 2 }], token: { mint: coin, name: 'Test', symbol: 'TEST' }, thesis: 'Test thesis about the coin.' };
const position = { mint: coin, amount: 2, name: 'Test', symbol: 'TEST', priceUsd: null, valueUsd: null, thesis: trade.thesis };
const feed = (now = start, trades = [], positions = [position]) => walletFeed({ enabled: true, readOnly: true, operatorControlled: true, wallet, observedAt: now, historyTruncated: false, trades, positions, updateIntervalMinutes: 10 });
test('initial connection baselines history, fresh swaps dedupe and age out', () => {
  const updates = new WalletAnnouncements();
  updates.ingest(feed(start, [{ ...trade, timestamp: start - 1000 }]), start); assert.equal(updates.peek(start), undefined);
  updates.ingest(feed(start + 2000, [{ ...trade, signature: '4'.repeat(88) }]), start + 2000);
  assert.equal(updates.take(start + 2000).kind, 'trade');
  updates.ingest(feed(start + 3000, [{ ...trade, signature: '4'.repeat(88) }]), start + 3000); assert.equal(updates.pending.length, 0);
  assert.throws(() => updates.ingest(feed(start), start + 100000));
  updates.ingest(feed(start + 4000, [trade]), start + 4000); assert.equal(updates.peek(start + 130000), undefined);
});
test('periodic open-position updates obey 10-20 minute cadence and remove closed positions', () => {
  const updates = new WalletAnnouncements(); updates.ingest(feed(), start);
  updates.ingest(feed(start + 599999), start + 599999); assert.equal(updates.peek(start + 599999), undefined);
  updates.ingest(feed(start + 600000), start + 600000); assert.equal(updates.take(start + 600000).kind, 'positions');
  updates.ingest(feed(start + 1199999), start + 1199999); assert.equal(updates.peek(start + 1199999), undefined);
  updates.ingest(feed(start + 1200000), start + 1200000); assert.ok(updates.periodic);
  updates.ingest(feed(start + 1200001, [], []), start + 1200001); assert.equal(updates.periodic, undefined);
  const delayed = new WalletAnnouncements(), twenty = { ...feed(), updateIntervalMinutes: 20 };
  delayed.ingest(twenty, start); delayed.ingest({ ...twenty, observedAt: start + 600000 }, start + 600000); assert.equal(delayed.peek(start + 600000), undefined);
});
test('stale snapshots, processed trades and non-owned labels cannot become speech', () => {
  assert.equal(walletFeed({ ...feed(), trades: [{ ...trade, confirmation: 'processed' }] }).trades.length, 0);
  assert.equal(walletFeed({ ...feed(), trades: [{ ...trade, token: { mint: wallet, name: 'Wrong' } }] }).trades[0].token, undefined);
  const updates = new WalletAnnouncements(); updates.ingest(feed(), start); updates.ingest(feed(start + 600000), start + 600000); assert.equal(updates.peek(start + 660001), undefined);
  assert.match(walletAnnouncement({ ...trade, kind: 'trade' }), /Rephrase the thesis/);
  assert.match(walletAnnouncement({ kind: 'positions', timestamp: start, positions: [position], holdingsTruncated: false }), /not a new buy or sell/);
});
test('wallet turns reserve the speaking gate without discarding the pending viewer', () => {
  const gate = new TurnGate(start); gate.phase = 'ready'; gate.enqueue('viewer', 'Question', start);
  assert.equal(gate.reserve(start), true); assert.equal(gate.reserve(start), false); assert.equal(gate.take(start), null);
  gate.started(start); gate.stopped(start + 1); assert.equal(gate.reserve(start + 2), false);
  assert.equal(gate.take(start + 3001).text, 'Question');
});
