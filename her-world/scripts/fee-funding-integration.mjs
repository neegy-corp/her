// Run only with a disposable, unfunded fixture created in the target database.
// Uses the application's real authenticated SQL gateway; never sends a chain transaction.
import assert from 'node:assert/strict';
import { registerHooks, createRequire } from 'node:module';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
const root = new URL('../', import.meta.url);
createRequire(import.meta.url)('@next/env').loadEnvConfig(process.cwd());
registerHooks({ resolve(s, c, n) {
  if (s.startsWith('@/')) s = new URL(s.slice(2), root).href;
  if ((s.startsWith('.') || s.startsWith('file:')) && c.parentURL?.startsWith(root.href)) {
    const u = new URL(s, c.parentURL);
    if (!u.pathname.endsWith('.ts') && existsSync(fileURLToPath(`${u.href}.ts`))) s = `${u.href}.ts`;
  }
  return n(s, c);
} });
const id = process.argv[2], owner = `acp-fee-fixture-${id}`;
if (!/^[a-f0-9-]{36}$/.test(id || '')) throw new Error('Provide a disposable fixture UUID.');
const { withDatabase } = await import('../lib/database.ts');
const store = await import('../lib/fee-funding-store.ts');
const credits = await import('../lib/stream-credit-store.ts');
await withDatabase(process.env.DATABASE_URL, async () => {
  await store.insertLaunchWallet(id, owner, `synthetic-public-${id}`, 'unfunded-test-placeholder');
  assert.equal(await store.launchWalletRow(id, 'wrong-owner'), null);
  const setup = await Promise.all(['a','b'].map(s => store.claimFeeSetup(id, owner, `setup-${s}`, 100)));
  assert.equal(setup.filter(Boolean).length, 1);
  await store.confirmFeeSetup(id, owner);
  const collection = await Promise.all(['a','b'].map(s => store.claimFeeCollection(id, owner, `collect-${s}`, 100)));
  assert.equal(collection.filter(Boolean).length, 1);
  assert.equal(await store.clearFeeCollection(id, owner, 'incorrect-signature'), null);
  const launch = await store.launchWalletRow(id, owner);
  await store.clearFeeCollection(id, owner, launch.collection_signature);
  const ids = [crypto.randomUUID(), crypto.randomUUID()];
  const startReserve=(await store.generationCapacity()).reserved_micro_usd;
  const claims = await Promise.all(ids.map((req, i) => store.claimTimePurchase(id, owner, `synthetic-${i}-${id}`, 5, 100, req, 100, 1000, startReserve+1000)));
  assert.equal(claims.filter(Boolean).length, 1, 'Only one simultaneous payment may be claimed');
  const index = claims.findIndex(Boolean), signature = `synthetic-${index}-${id}`;
  const original = await store.timePurchaseRequest(id, owner, ids[index]);
  assert.equal(original.last_valid_block_height, 100);
  assert.equal(await store.timePurchaseRequest(id, 'wrong-owner', ids[index]), null);
  const credited = await Promise.all([store.creditTimePurchase(id, owner, signature), store.creditTimePurchase(id, owner, signature)]);
  assert.equal(credited.filter(Boolean).length, 1, 'Credit is applied exactly once');
  assert.equal((await credits.creditAccount(id, owner)).video_seconds, 300);
  assert.equal(await store.claimTimePurchase(id, owner, `replay-${id}`, 5, 100, ids[index], 110,1000,startReserve+2000), null, 'Retry cannot charge again after settlement');
  assert.equal((await store.generationCapacity()).reserved_micro_usd,startReserve+1000);
  assert.equal(await store.claimTimePurchase(id,owner,`unfunded-${id}`,5,100,crypto.randomUUID(),110,1000,startReserve+1000),null,'Do not sell beyond funded capacity');
  assert.equal((await credits.creditAccount(id,owner)).portrait_credits,5);
  assert.equal((await credits.creditAccount(id,owner)).script_credits,100);
  for(let i=0;i<99;i++) assert.ok(await credits.debitScript(id,owner));
  const scripts=await Promise.all([credits.debitScript(id,owner),credits.debitScript(id,owner)]);
  assert.equal(scripts.filter(Boolean).length,1);
  assert.equal(await credits.debitScript(id,owner),null);
  const grants = await Promise.all([store.grantFreeVideo(id, owner, 15), store.grantFreeVideo(id, owner, 15)]);
  assert.equal(grants.filter(Boolean).length, 1);
  assert.equal((await credits.creditAccount(id, owner)).video_seconds, 315);
  // Consume all but one render's allowance; then race two provider reservations.
  const render = () => ({id: crypto.randomUUID(), character_id: id, wallet: owner, clip_id: crypto.randomUUID(), fingerprint: crypto.randomUUID(), provider: 'higgsfield', created_at: Date.now()});
  for(let i=0;i<4;i++) assert.ok(await credits.claimPortrait(render()));
  const portraitA=render(),portraitB=render();
  const portraits=await Promise.all([credits.claimPortrait(portraitA),credits.claimPortrait(portraitB)]);
  assert.equal(portraits.filter(Boolean).length,1);
  assert.equal(await credits.claimPortrait(portraits[0]?portraitA:portraitB),null);
  assert.equal((await credits.creditAccount(id,owner)).portrait_credits,0);
  for (let i=0; i<20; i++) assert.ok(await credits.claimCreditRender(render(), 15));
  const a=render(), b=render();
  const debits = await Promise.all([credits.claimCreditRender(a,15), credits.claimCreditRender(b,15)]);
  assert.equal(debits.filter(Boolean).length, 1, 'Concurrent renders cannot overdraw');
  assert.equal((await credits.creditAccount(id, owner)).video_seconds, 0);
  const winner = debits[0] ? a : b;
  assert.equal(await credits.claimCreditRender(winner,15), null);
  const now=Date.now(), session=crypto.randomUUID();
  const active=await credits.startCreditSession(id,owner,session,now);
  assert.equal(active.ends_at,now+315000);
  assert.equal((await credits.startCreditSession(id,owner,session,now+1000)).ends_at,active.ends_at);
  await assert.rejects(credits.startCreditSession(id,owner,crypto.randomUUID(),now+1000));
  assert.equal((await credits.stopCreditSession(id,owner,session,now+10000)).stream_seconds,305);
  assert.equal(await credits.stopCreditSession(id,owner,session,now+10000),null);
  const other=process.argv[3];
  if(other){
    assert.match(other,/^[a-f0-9-]{36}$/);
    const capacity=(await store.generationCapacity()).reserved_micro_usd;
    const characters=[id,other];
    const concurrent=await Promise.all(characters.map(c=>store.claimTimePurchase(c,`acp-fee-fixture-${c}`,`capacity-${c}`,5,100,crypto.randomUUID(),120,1000,capacity+1000)));
    assert.equal(concurrent.filter(Boolean).length,1,'Different customers cannot oversell the global provider budget');
    const winner=characters[concurrent.findIndex(Boolean)];
    const released=await Promise.all([store.expireTimePurchase(winner,`acp-fee-fixture-${winner}`,`capacity-${winner}`),store.expireTimePurchase(winner,`acp-fee-fixture-${winner}`,`capacity-${winner}`)]);
    assert.equal(released.filter(Boolean).length,1,'Failed payment releases capacity once');
    assert.equal((await store.generationCapacity()).reserved_micro_usd,capacity);
  }
  console.log('PASS: live gateway owner isolation, payment race, replay protection, exactly-once credits, setup/collection claims, render overdraft prevention, session exclusion and stop/refund. No chain transactions sent.');
});
