import test from 'node:test';
import assert from 'node:assert/strict';
import { registerHooks, createRequire } from 'node:module';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
const root = new URL('../', import.meta.url);
registerHooks({resolve(specifier, context, next) {
  if (specifier.startsWith('@/')) specifier = new URL(specifier.slice(2), root).href;
  if ((specifier.startsWith('.') || specifier.startsWith('file:')) && context.parentURL?.startsWith(root.href)) {
    const url = new URL(specifier, context.parentURL);
    if (!url.pathname.endsWith('.ts') && existsSync(fileURLToPath(`${url.href}.ts`))) specifier = `${url.href}.ts`;
  }
  return next(specifier, context);
}});
const { streamCreditsEnabled, claimCreditRender } = await import('../lib/stream-credit-store.ts');
const { solUsd, lamportsFor, timeQuotes, videoUsdPerSecond, resetSolPriceCache } = await import('../lib/sol-price.ts');
const { streamPlans, streamPlan } = await import('../lib/stream-plans.ts');
const route = await import('../app/api/launchpad/credits/route.ts');
const { ContinuousShowRunner } = await import('../lib/continuous-show.ts');
const { VIDEO_CREDIT_EXHAUSTED } = await import('../lib/stream-plans.ts');
const { seal, open, exportSecret, launchWalletsConfigured } = await import('../lib/launch-wallet.ts');
const { buildFeeSharingSetup, feeShareholders, buildAcpCreate } = await import('../lib/acp-coin.ts');
const { ACP_FREE_VIDEO_SECONDS, ACP_FEE_WALLET, ACP_PLATFORM_FEE_BPS, ACP_DEVELOPER_FEE_BPS, ACP_VIDEO_USD_PER_SECOND } = await import('../lib/acp-config.ts');
const { Keypair } = await import('@solana/web3.js');
const {fundedCreator,requirePaidGeneration}=await import('../lib/launchpad-media.ts');
const {fulfillmentMicroUsd,providerBudgetMicroUsd}=await import('../lib/generation-billing.ts');
const portraitRoute=await import('../app/api/launchpad/portrait/route.ts');
const scriptRoute=await import('../app/api/launchpad/scripts/route.ts');
const {newDraft}=await import('../lib/launchpad.ts');
const bs58 = (await import('bs58')).default;
function restoreEnv(previous) {for(const key of Object.keys(process.env)) if(!(key in previous)) delete process.env[key];Object.assign(process.env,previous);}
const KEY = Buffer.alloc(32, 7).toString('base64');

test('public access requires explicit activation and funded capacity; generation cannot bypass payments',()=>{
 const previous={...process.env};
 try{
  process.env.HER_LAUNCHPAD_CREATOR_WALLETS='pilot';process.env.ACP_STREAM_CREDITS_ENABLED='false';process.env.ACP_PUBLIC_GENERATION_ENABLED='true';process.env.ACP_PROVIDER_BUDGET_USD='100';
  assert.throws(()=>fundedCreator('public'));assert.throws(requirePaidGeneration);
  process.env.ACP_STREAM_CREDITS_ENABLED='true';fundedCreator('public');requirePaidGeneration();
  for(const bad of ['','0','-1','NaN']){process.env.ACP_PROVIDER_BUDGET_USD=bad;assert.equal(providerBudgetMicroUsd(),0);assert.throws(()=>fundedCreator('public'));}
  assert.ok(fulfillmentMicroUsd(5)>50e6);assert.equal(fulfillmentMicroUsd(25),5*fulfillmentMicroUsd(5));
 }finally{restoreEnv(previous);}
});
test('public wallets without paid allowances cannot invoke portrait or script providers',async()=>{
 const oldFetch=globalThis.fetch,previous={...process.env};let providers=0;
 const draft={...newDraft(),name:'Test character',appearance:'Original adult character wearing a blue jacket',rightsConfirmed:true};
 try{
  Object.assign(process.env,{DATABASE_URL:'postgres://test:fixture@example.invalid/postgres',ACP_PUBLIC_GENERATION_ENABLED:'true',ACP_PROVIDER_BUDGET_USD:'100',ACP_STREAM_CREDITS_ENABLED:'true',HER_LAUNCHPAD_ENABLED:'true',HER_LAUNCHPAD_GENERATION_ENABLED:'true',ACP_SCRIPTS_ENABLED:'true',HF_API_KEY:'test-only',ANTHROPIC_API_KEY:'test-only',BLOB_READ_WRITE_TOKEN:'test-only',HER_LAUNCHPAD_CREATOR_WALLETS:''});
  globalThis.fetch=async(url,options)=>{
   if(!String(url).includes('/her-database')){providers++;throw new Error('Provider must not be called');}
   const statements=JSON.parse(options.body).statements;
   return Response.json({results:statements.map(({query})=>({results:query.includes('launchpad_usage')?[{attempts:1}]:query.includes('wallet_sessions')?[{wallet:'public'}]:query.includes('SELECT * FROM her_private.launchpad_characters')?[{id:draft.id,wallet:'public',document:JSON.stringify(draft),face_status:'draft',mint:null}]:[],meta:{changes:0}}))});
  };
  const headers={Origin:'https://acp.example',cookie:`her-wallet=${'a'.repeat(64)}`};
  const portrait=await portraitRoute.POST(new Request(`https://acp.example/api/launchpad/portrait?id=${draft.id}`,{method:'POST',headers}));
  assert.equal(portrait.status,402,JSON.stringify(await portrait.json()));
  const script=await scriptRoute.POST(new Request('https://acp.example/api/launchpad/scripts',{method:'POST',headers,body:JSON.stringify({id:draft.id,mode:'script',brief:'Introduce the character'})}));
  assert.equal(script.status,402,JSON.stringify(await script.json()));assert.equal(providers,0);
 }finally{globalThis.fetch=oldFetch;restoreEnv(previous);}
});

test('generation has no free grant; credits are flag driven', () => {
  assert.equal(ACP_FREE_VIDEO_SECONDS, 0);
  const previous = {...process.env};
  try {
    process.env.ACP_STREAM_CREDITS_ENABLED = 'false'; assert.equal(streamCreditsEnabled(), false);
    process.env.ACP_STREAM_CREDITS_ENABLED = 'true'; assert.equal(streamCreditsEnabled(), true);
  } finally { restoreEnv(previous); }
});
test('purchasable lengths are 5 to 25 minutes and anything else is rejected', () => {
  assert.deepEqual(streamPlans.map(p => [p.minutes, p.seconds]), [[5,300],[10,600],[15,900],[20,1200],[25,1500]]);
  for (const bad of [0, 4, 6, 30, 60, '5', null, undefined, NaN]) assert.throws(() => streamPlan(bad));
});
test('price is linear in video length and rounds up so ACP never undercharges', async () => {
  const previous = {...process.env};
  try {
    delete process.env.ACP_VIDEO_USD_PER_SECOND;process.env.ACP_SOL_USD_OVERRIDE='200';process.env.HER_LAUNCHPAD_CREATOR_WALLETS='owner';
    assert.equal(videoUsdPerSecond(), ACP_VIDEO_USD_PER_SECOND);
    const quotes = await timeQuotes();
    // 300 s at the default rate and 200 USD/SOL
    assert.equal(quotes[0].lamports, Math.ceil(300 * ACP_VIDEO_USD_PER_SECOND * 1e9 / 200));
    assert.equal(quotes[4].lamports, quotes[0].lamports * 5);
    assert.deepEqual(quotes.map(q => q.minutes), [5,10,15,20,25]);
    assert.equal(lamportsFor(1, 0.2, 3), Math.ceil(0.2 * 1e9 / 3));
    process.env.ACP_VIDEO_USD_PER_SECOND='0.5';assert.equal(videoUsdPerSecond(), 0.5);
    for (const bad of ['0','-1','50','x']) { process.env.ACP_VIDEO_USD_PER_SECOND=bad; assert.equal(videoUsdPerSecond(), ACP_VIDEO_USD_PER_SECOND); }
  } finally { restoreEnv(previous); }
});
test('live SOL price is cached, bounded and never taken from a stale or absurd feed', async () => {
  const oldFetch = globalThis.fetch, previous = {...process.env}; let calls = 0;
  const feed = (price, age = 5) => async () => { calls++; return Response.json({ parsed: [{ price: { price: String(price), expo: -8, publish_time: Math.floor(Date.now()/1000) - age } }] }); };
  try {
    delete process.env.ACP_SOL_USD_OVERRIDE;
    resetSolPriceCache(); globalThis.fetch = feed(15000000000); assert.equal(await solUsd(), 150); assert.equal(await solUsd(), 150); assert.equal(calls, 1);
    resetSolPriceCache(); globalThis.fetch = feed(15000000000, 600); await assert.rejects(solUsd(), /unavailable/);
    resetSolPriceCache(); globalThis.fetch = feed(100, 5); await assert.rejects(solUsd(), /unavailable/);
    resetSolPriceCache(); globalThis.fetch = async () => new Response('x', { status: 500 }); await assert.rejects(solUsd(), /unavailable/);
  } finally { globalThis.fetch = oldFetch; resetSolPriceCache(); restoreEnv(previous); }
});
test('launch wallet secrets are encrypted, bound to character and owner, and exportable', () => {
  const previous = {...process.env};
  try {
    delete process.env.ACP_LAUNCH_WALLET_KEY; assert.equal(launchWalletsConfigured(), false);
    process.env.ACP_LAUNCH_WALLET_KEY = 'short'; assert.equal(launchWalletsConfigured(), false);
    process.env.ACP_LAUNCH_WALLET_KEY = KEY; assert.equal(launchWalletsConfigured(), true);
    const pair = Keypair.generate(), sealed = seal(pair.secretKey, 'char-1', 'owner-1');
    assert.ok(!sealed.includes(Buffer.from(pair.secretKey).toString('base64')));
    assert.deepEqual([...open(sealed, 'char-1', 'owner-1')], [...pair.secretKey]);
    assert.throws(() => open(sealed, 'char-2', 'owner-1'));
    assert.throws(() => open(sealed, 'char-1', 'owner-2'));
    const tampered = sealed.split('.'); tampered[1] = Buffer.from('x'.repeat(64)).toString('base64');
    assert.throws(() => open(tampered.join('.'), 'char-1', 'owner-1'));
    assert.equal(Keypair.fromSecretKey(bs58.decode(exportSecret(sealed, 'char-1', 'owner-1'))).publicKey.toBase58(), pair.publicKey.toBase58());
    assert.notEqual(seal(pair.secretKey, 'char-1', 'owner-1'), sealed);
    process.env.ACP_LAUNCH_WALLET_KEY = Buffer.alloc(32, 9).toString('base64');
    assert.throws(() => open(sealed, 'char-1', 'owner-1'));
  } finally { restoreEnv(previous); }
});
test('fee split is a locked 50/50 between the ACP fee wallet and the launch wallet', async () => {
  assert.equal(ACP_FEE_WALLET, '5psWWm8BAjWBGt54jSn8DgCrQEDnq8FurqbaTAuaCqyi');
  assert.equal(ACP_PLATFORM_FEE_BPS + ACP_DEVELOPER_FEE_BPS, 10000); assert.equal(ACP_PLATFORM_FEE_BPS, 5000);
  const launch = Keypair.generate().publicKey, mint = Keypair.generate().publicKey;
  const shares = feeShareholders(launch.toBase58());
  assert.deepEqual(shares.map(s => [s.address.toBase58(), s.shareBps]), [[ACP_FEE_WALLET, 5000], [launch.toBase58(), 5000]]);
  assert.throws(() => feeShareholders(ACP_FEE_WALLET));
  const [create, update] = await buildFeeSharingSetup({ mint, launchWallet: launch });
  assert.ok(create.keys.some(k => k.pubkey.equals(launch) && k.isSigner));
  assert.ok(update.keys.some(k => k.pubkey.equals(launch) && k.isSigner));
  const { PUMP_SDK } = createRequire(import.meta.url)('@pump-fun/pump-sdk');
  const decoded = PUMP_SDK.offlinePumpFeeProgram.coder.instruction.decode(update.data);
  assert.equal(decoded.name, 'updateFeeSharesV2');
  assert.deepEqual(decoded.data.shareholders.map(h => [h.address.toBase58(), h.shareBps]), [[ACP_FEE_WALLET, 5000], [launch.toBase58(), 5000]]);
  assert.ok(create.data.length > 0 && update.data.length > 0);
});
test('real SDK encodes a standard SOL coin created by the launch wallet with no custom fee or quote', async () => {
  const mint = Keypair.generate(), creator = Keypair.generate();
  const instruction = await buildAcpCreate({ mint: mint.publicKey, creator: creator.publicKey, name: 'ACP fixture', symbol: 'ACPT', uri: 'https://example.com/metadata.json' });
  const { PumpSdk } = createRequire(import.meta.url)('@pump-fun/pump-sdk');
  const decoded = new PumpSdk().offlinePumpProgram.coder.instruction.decode(instruction.data);
  assert.equal(decoded.name, 'createV2');
  assert.equal(decoded.data.creator.toBase58(), creator.publicKey.toBase58());
  assert.equal(decoded.data.isHolderReward[0], false);
  assert.ok(!decoded.data.creatorFeeBps || decoded.data.creatorFeeBps[0].toString() === '0');
  assert.ok(instruction.keys.some(k => k.pubkey.equals(creator.publicKey) && k.isSigner));
  await assert.rejects(buildAcpCreate({ mint: mint.publicKey, creator: creator.publicKey, name: 'x'.repeat(40), symbol: 'ACPT', uri: 'https://e.com/m.json' }));
});
test('invalid render debit is rejected before storage or provider access', async () => {
  for (const seconds of [-15,0,2,16,3.5,NaN]) await assert.rejects(claimCreditRender({},seconds),/duration/);
});
test('top-up increases continuous generation budget and resumes only pre-charge credit failures',()=>{
  const runner=new ContinuousShowRunner('fixture',{maxGenerations:0},{});
  runner.submitted=12;runner.generationPaused=true;runner.error=VIDEO_CREDIT_EXHAUSTED;
  runner.updateVideoAllowance(3);assert.equal(runner.generationPaused,true);
  runner.updateVideoAllowance(900);assert.equal(runner.plan.maxGenerations,312);assert.equal(runner.generationPaused,false);
  runner.generationPaused=true;runner.error='Provider submission unknown';
  runner.updateVideoAllowance(1800);assert.equal(runner.generationPaused,true);
});
test('unauthenticated and cross-origin credit actions are denied', async () => {
  assert.equal((await route.GET(new Request('https://acp.example/api/launchpad/credits?id=fixture'))).status,401);
  const response=await route.POST(new Request('https://acp.example/api/launchpad/credits?id=fixture&action=buy',{method:'POST',headers:{Origin:'https://attacker.example'},body:'{}'}));
  assert.equal(response.status,400);assert.match((await response.json()).error,/origin/);
});
test('buying time needs a launch wallet but no coin; wrong owner is denied', async () => {
  const oldFetch=globalThis.fetch,previous={...process.env};let owner=true;
  try {
    process.env.DATABASE_URL='postgres://test:fixture@example.invalid/postgres';
    process.env.ACP_STREAM_CREDITS_ENABLED='true';process.env.ACP_SOL_USD_OVERRIDE='200';process.env.HER_LAUNCHPAD_CREATOR_WALLETS='owner';
    process.env.ACP_PROVIDER_BUDGET_USD='1000';
    globalThis.fetch=async(_url,options)=>{
      const [{query}]=JSON.parse(options.body).statements;
      const rows=query.includes('wallet_sessions')?[{wallet:'owner'}]:query.includes('launchpad_characters')?(owner?[{id:'fixture',wallet:'owner',mint:null}]:[]):[];
      return Response.json({results:[{results:rows,meta:{changes:0}}]});
    };
    const headers={cookie:`her-wallet=${'a'.repeat(64)}`,Origin:'https://acp.example'};
    const state=await route.GET(new Request('https://acp.example/api/launchpad/credits?id=fixture',{headers}));
    assert.equal(state.status,200);
    const body=await state.json();
    assert.equal(body.enabled,true);assert.equal(body.freeSeconds,0);assert.equal(body.quotes.length,5);assert.equal(body.walletLamports,null);assert.equal(body.freeGranted,false);assert.equal(body.feeSetup,'none');
    const buy=await route.POST(new Request('https://acp.example/api/launchpad/credits?id=fixture&action=buy',{method:'POST',headers,body:'{"minutes":5}'}));
    assert.equal(buy.status,400);assert.match((await buy.json()).error,/launch wallet/);
    const grant=await route.POST(new Request('https://acp.example/api/launchpad/credits?id=fixture&action=grant',{method:'POST',headers,body:'{}'}));
    assert.equal(grant.status,410);
    owner=false;
    assert.equal((await route.GET(new Request('https://acp.example/api/launchpad/credits?id=fixture',{headers}))).status,404);
  } finally {globalThis.fetch=oldFetch;restoreEnv(previous);}
});
