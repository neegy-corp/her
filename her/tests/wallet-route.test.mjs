import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import ts from 'typescript';
import { Miniflare } from 'miniflare';

test('wallet route runs in workerd and rejects redirects and failed authentication', async () => {
  const route = ts.transpileModule(readFileSync(new URL('../app/api/wallet/route.ts', import.meta.url), 'utf8')
    .replace(/^import .*;\r?\n/gm, ''), { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext } }).outputText;
  const validator = ts.transpileModule(readFileSync(new URL('../lib/wallet-updates.ts', import.meta.url), 'utf8'),
    { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext } }).outputText;
  const mf = new Miniflare({ modules: true, compatibilityDate: '2026-05-15', script: `
    const authorize = async () => null;
    const json = (body, status=200) => Response.json(body, {status});
    const setting = key => ({HER_WALLET_UPDATES_ENABLED:'true',HER_WALLET_FEED_URL:'https://feed.example/api',HER_WALLET_READ_TOKEN:'test-read-token-never-a-signing-key-123456789'})[key];
    let upstreamStatus = 200, requests = 0;
    globalThis.fetch = async (input, init) => {
      // Native Request validates options in the actual edge runtime.
      const request = new Request(input, init);
      requests++;
      if (request.redirect !== 'manual') throw Error('Redirects must not be followed');
      if (upstreamStatus !== 200) return new Response('', {status:upstreamStatus,headers:{Location:'https://other.example'}});
      return Response.json({enabled:true,readOnly:true,wallet:'11111111111111111111111111111111',observedAt:Date.now(),trades:[],historyTruncated:false,positions:[],holdingsTruncated:false,updateIntervalMinutes:10});
    };
    ${validator}
    ${route}
    export default {async fetch(request) {upstreamStatus=Number(new URL(request.url).searchParams.get('status')||200);requests=0;const result=await GET(request);result.headers.set('X-Test-Requests',String(requests));return result;}}
  ` });
  try {
    const good = await mf.dispatchFetch('http://localhost/');
    assert.equal(good.status, 200); assert.equal((await good.json()).readOnly, true);
    for (const status of [302, 401, 503]) {
      const bad = await mf.dispatchFetch(`http://localhost/?status=${status}`);
      assert.equal(bad.status, 503); assert.equal(bad.headers.get('X-Test-Requests'), '1');
      assert.equal((await bad.text()).includes('test-read-token'), false);
    }
  } finally { await mf.dispose(); }
});
