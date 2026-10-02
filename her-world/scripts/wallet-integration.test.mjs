import assert from 'node:assert/strict';
import nacl from 'tweetnacl';
import bs58 from 'bs58';
import postgres from 'postgres';
import ca from '../db/supabase-ca.ts';

const base = process.env.HER_TEST_ORIGIN || 'http://127.0.0.1:5180';
if (!/^http:\/\/(127\.0\.0\.1|localhost):\d+$/.test(base)) throw new Error('Integration tests require a local app.');
const key = nacl.sign.keyPair(), address = bs58.encode(key.publicKey);
const sql = postgres(process.env.DATABASE_URL, { ssl: { rejectUnauthorized: true, ca }, prepare: false, max: 1 });
let cookie = '';
const post = (action, data, origin = base) => fetch(`${base}/api/her?action=${action}`, {
  method: 'POST', headers: { Origin: origin, 'Content-Type': 'application/json', Cookie: cookie },
  body: JSON.stringify(data), signal: AbortSignal.timeout(20000),
});
try {
  assert.ok([400,403].includes((await post('challenge', { wallet: address }, 'https://wrong.example')).status));
  const challenge = await (await post('challenge', { wallet: address })).json();
  assert.ok(challenge.id); assert.ok(challenge.message.includes('This does not burn tokens'));
  const stored = await sql`select id from her_private.challenges where id = ${challenge.id}`;
  assert.equal(stored.length, 1, 'challenge persists in Supabase');
  const signature = bs58.encode(nacl.sign.detached(new TextEncoder().encode(challenge.message), key.secretKey));
  const wrongSignature = bs58.encode(nacl.sign.detached(new TextEncoder().encode(challenge.message), nacl.sign.keyPair().secretKey));
  assert.equal((await post('signin', { id: challenge.id, wallet: address, signature: wrongSignature })).status, 400);
  const signed = await post('signin', { id: challenge.id, wallet: address, signature });
  assert.equal(signed.status, 200);
  assert.match(signed.headers.get('set-cookie'), /HttpOnly; SameSite=Strict/);
  cookie = signed.headers.get('set-cookie').split(';')[0];
  const me = await (await fetch(`${base}/api/her?action=me`, { headers: { Cookie: cookie } })).json();
  assert.equal(me.wallet, address); assert.equal(me.isHost, false);
  assert.equal((await post('signin', { id: challenge.id, wallet: address, signature })).status, 400, 'challenge replay rejected');
  assert.equal((await fetch(`${base}/api/her?action=admin`, { headers: { Cookie: cookie } })).status, 403);
  assert.equal((await post('prepare', { kind: 'stage' })).status, 403, 'burns stay closed');
  assert.equal((await post('logout', {})).status, 200);
  const afterLogout = await (await fetch(`${base}/api/her?action=me`, { headers: { Cookie: cookie } })).json();
  assert.equal(afterLogout.wallet, null, 'previous session cannot be reused after logout');
  const endpoint = 'https://mkewxmunkqsyziatkqfz.supabase.co/functions/v1/her-database';
  assert.equal((await fetch(endpoint, { method: 'POST', body: '{}' })).status, 401);
  assert.equal((await fetch(endpoint, { method: 'POST', headers: { Authorization: `Bearer ${'0'.repeat(64)}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ statements: [{ query: 'SELECT wallet FROM her_private.wallet_sessions WHERE id = ? AND expires > ?', values: ['absent', Date.now()] }] }) })).status, 401, 'invalid gateway credential rejected');
  const password = decodeURIComponent(new URL(process.env.DATABASE_URL).password);
  assert.equal((await fetch(endpoint, { method: 'POST', headers: { Authorization: `Bearer ${password}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ statements: [{ query: 'SELECT * FROM auth.users', values: [] }] }) })).status, 400, 'gateway rejects non-allowlisted queries');
  const duplicate = `test-${crypto.randomUUID()}`;
  const statement = { query: 'INSERT INTO her_private.challenges (id,wallet,message,expires) VALUES (?,?,?,?)', values: [duplicate,address,'rollback test',Date.now()+30000] };
  const rolledBack = await fetch(endpoint, { method: 'POST', headers: { Authorization: `Bearer ${password}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ statements: [statement, statement] }) });
  assert.equal(rolledBack.status, 409);
  assert.equal((await sql`select id from her_private.challenges where id = ${duplicate}`).length, 0, 'failed batch is fully rolled back');
  const rollback = new Error('rollback fixtures');
  try {
    await sql.begin(async tx => {
      for (const id of [duplicate+'a',duplicate+'b']) {
        await tx`insert into her_private.burn_intents (id,wallet,kind,amount,raw_amount,mint,decimals,program,name,topic,created_at,expires)
          values (${id},${address},'stage','1','1','test-only',0,'test-only','Test','Temporary fixture',0,1)`;
        await tx`insert into her_private.burn_receipts (id,wallet,kind,amount,signature,created_at) values (${id},${address},'stage','1',${id},0)`;
        await tx`insert into her_private.stage_requests (id,wallet,name,topic,status,created_at) values (${id},${address},'Test','Temporary fixture','accepted',0)`;
      }
      await tx`update her_private.stage_requests set status='on_stage' where id=${duplicate+'a'}`;
      await assert.rejects(tx.savepoint(async s => { await s`update her_private.stage_requests set status='on_stage' where id=${duplicate+'b'}`; }), { code: '23505' });
      throw rollback;
    });
  } catch (error) { if (error !== rollback) throw error; }
  assert.equal((await sql`select id from her_private.burn_intents where id in (${duplicate+'a'},${duplicate+'b'})`).length,0);
  console.log('PASS: Supabase persistence, valid wallet signature, invalid signature, nonce replay, host guard, closed burns, logout revocation, and gateway access restrictions.');
} finally {
  await sql`delete from her_private.challenges where wallet = ${address}`;
  await sql`delete from her_private.wallet_sessions where wallet = ${address}`;
  await sql.end();
}
