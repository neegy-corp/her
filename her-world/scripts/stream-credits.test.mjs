import test from 'node:test';
import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { streamPlans, streamPlan } from '../lib/stream-plans.ts';
import { validateBurn } from '../lib/burn-validation.ts';
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
const route = await import('../app/api/launchpad/credits/route.ts');
const {ContinuousShowRunner}=await import('../lib/continuous-show.ts');
const {VIDEO_CREDIT_EXHAUSTED}=await import('../lib/stream-plans.ts');
function restoreEnv(previous) {for(const key of Object.keys(process.env)) if(!(key in previous)) delete process.env[key];Object.assign(process.env,previous);}

test('fixed ACP pricing covers 15 through 60 minutes; arbitrary amounts rejected', () => {
  assert.deepEqual(streamPlans.map(p => [p.minutes,p.tokens,p.seconds]), [[15,50000,900],[30,100000,1800],[45,150000,2700],[60,200000,3600]]);
  for (const value of [0, -15, 14, 16, 120, '15', null, undefined]) assert.throws(() => streamPlan(value));
});
test('main token mint and activation are both required', () => {
  const previous = {...process.env};
  try {
    delete process.env.ACP_CREDIT_MINT;process.env.ACP_STREAM_CREDITS_ENABLED='true';
    assert.equal(streamCreditsEnabled(),false);
    process.env.ACP_CREDIT_MINT='fixture-mint';process.env.ACP_STREAM_CREDITS_ENABLED='false';
    assert.equal(streamCreditsEnabled(),false);
    process.env.ACP_STREAM_CREDITS_ENABLED='true';assert.equal(streamCreditsEnabled(),true);
  } finally { restoreEnv(previous); }
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
test('ACP receipt cannot be confused with a character coin, HER vote, or other time purchase', () => {
  const expected={wallet:'owner',mint:'main-acp',program:'token',raw_amount:'50000000000',id:'intent',memo:'ACP:stream:intent',created_at:100000,expires:200000};
  const valid=()=>({blockTime:120,meta:{err:null},transaction:{message:{accountKeys:[{pubkey:'owner',signer:true}],instructions:[{programId:'token',parsed:{type:'burnChecked',info:{mint:'main-acp',authority:'owner',tokenAmount:{amount:'50000000000'}}}},{programId:'MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr',parsed:'ACP:stream:intent'}]}}});
  assert.equal(validateBurn(valid(),expected),true);
  for (const memo of ['HER:intent','ACP:stream:other']) { const tx=valid();tx.transaction.message.instructions[1].parsed=memo;assert.throws(()=>validateBurn(tx,expected)); }
  const tx=valid();tx.transaction.message.instructions[0].parsed.info.mint='character-token';assert.throws(()=>validateBurn(tx,expected));
});
test('unauthenticated and cross-origin credit actions are denied', async () => {
  assert.equal((await route.GET(new Request('https://acp.example/api/launchpad/credits?id=fixture'))).status,401);
  const response=await route.POST(new Request('https://acp.example/api/launchpad/credits?id=fixture&action=prepare',{method:'POST',headers:{Origin:'https://attacker.example'},body:'{"minutes":15}'}));
  assert.equal(response.status,400);assert.match((await response.json()).error,/origin/);
});
test('unlaunched mint never accesses a credit table or prepares a burn; wrong owner is denied', async () => {
  const oldFetch=globalThis.fetch,previous={...process.env};let owner=true;
  try {
    process.env.DATABASE_URL='postgres://test:fixture@example.invalid/postgres';
    process.env.ACP_STREAM_CREDITS_ENABLED='true';delete process.env.ACP_CREDIT_MINT;
    globalThis.fetch=async(_url,options)=>{
      const [{query}]=JSON.parse(options.body).statements;
      assert.doesNotMatch(query,/stream_credit/);
      const rows=query.includes('wallet_sessions')?[{wallet:'owner'}]:owner?[{id:'fixture',wallet:'owner'}]:[];
      return Response.json({results:[{results:rows,meta:{changes:0}}]});
    };
    const headers={cookie:`her-wallet=${'a'.repeat(64)}`,Origin:'https://acp.example'};
    const response=await route.GET(new Request('https://acp.example/api/launchpad/credits?id=fixture',{headers}));
    assert.equal(response.status,200);assert.equal((await response.json()).enabled,false);
    const purchase=await route.POST(new Request('https://acp.example/api/launchpad/credits?id=fixture&action=prepare',{method:'POST',headers,body:'{"minutes":15}'}));
    assert.equal(purchase.status,503);
    owner=false;
    assert.equal((await route.GET(new Request('https://acp.example/api/launchpad/credits?id=fixture',{headers}))).status,404);
  } finally {globalThis.fetch=oldFetch;restoreEnv(previous);}
});
