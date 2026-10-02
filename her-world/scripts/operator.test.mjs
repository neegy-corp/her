import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync, existsSync } from 'node:fs';
import { registerHooks } from 'node:module';
import { fileURLToPath } from 'node:url';
import { Keypair, TransactionMessage, VersionedTransaction, SystemProgram } from '@solana/web3.js';
import { authConfigured, passwordHash, passwordMatches, validOperatorKey, newSession, sessionValid, sessionCookie, throttleKey } from '../lib/operator-auth.ts';
import { decimal, units, intervalMinutes, thesisText, tradeInput } from '../lib/operator-input.ts';
import { verifySignedTransaction } from '../lib/operator-transaction.ts';
import { previewLoginAllowed } from '../lib/operator-preview.ts';
import bs58 from 'bs58';

// Resolve the app's bundler-style local imports under Node's native TS runner.
const root = new URL('../', import.meta.url);
registerHooks({ resolve(specifier, context, next) {
  if (specifier.startsWith('@/')) specifier = new URL(specifier.slice(2), root).href;
  if ((specifier.startsWith('.') || specifier.startsWith('file:')) && context.parentURL?.startsWith(root.href)) {
    const target = new URL(specifier, context.parentURL);
    if (!target.pathname.endsWith('.ts') && existsSync(fileURLToPath(`${target.href}.ts`))) specifier = `${target.href}.ts`;
  }
  return next(specifier, context);
} });
const { backendSigner, signReviewedOrder, signerConfigured } = await import('../lib/operator-signer.ts');
const { withDatabase } = await import('../lib/database.ts');
const store = await import('../lib/operator-store.ts');
const route = await import('../app/operator/[key]/api/route.ts');
const trading = await import('../lib/operator-trading.ts');
const { reportingFeed } = await import('../lib/wallet-service.ts');
const secret = 'a'.repeat(64), key = 'b'.repeat(64), password = 'unit-test-only-password-123456789';
const hash = await passwordHash(password);

test('password hashes, high-entropy path and constant-time authentication', async () => {
  assert.notEqual(hash, password); assert.equal(authConfigured(hash, secret), true);
  assert.equal(await passwordMatches(password, hash), true);
  assert.equal(await passwordMatches('wrong-password-that-is-long-enough', hash), false);
  assert.equal(await passwordMatches('short', hash), false);
  assert.equal(validOperatorKey(key, key), true); assert.equal(validOperatorKey('c'.repeat(64), key), false);
  assert.equal(validOperatorKey('guessable', 'guessable'), false);
  assert.equal(authConfigured(hash, 'short'), false);
});
test('sessions expire, rotate with password/secret and are scoped secure cookies', () => {
  const now = Date.now(), token = newSession(secret, hash, now), cookie = `her-operator=${token}`;
  assert.equal(sessionValid(cookie, secret, hash, now), true);
  assert.equal(sessionValid(cookie, secret, hash, now + 8 * 3600000), false);
  assert.equal(sessionValid(cookie, 'c'.repeat(64), hash, now), false);
  assert.equal(sessionValid(cookie, secret, hash.replace(/.$/, hash.endsWith('a') ? 'b' : 'a'), now), false);
  assert.equal(sessionValid(`${cookie}x`, secret, hash, now), false);
  assert.match(sessionCookie(key, token, true), /HttpOnly; SameSite=Strict; Max-Age=28800; Secure/);
  assert.match(sessionCookie(key, '', true), /Max-Age=0/);
  assert.equal(throttleKey('127.0.0.1', secret).includes('127.0.0.1'), false);
});
test('amount parsing never rounds money and rejects unsafe input', () => {
  assert.equal(units('0.000000001', 9), '1'); assert.equal(units('123.456', 6), '123456000');
  assert.equal(decimal('1000000000', 9), '1'); assert.equal(decimal('10', 0), '10');
  assert.equal(decimal('123456', 6), '0.123456');
  for (const value of ['0', '-1', '1e3', 'Infinity', '0.0000000001', '18446744073709551616']) assert.throws(() => units(value, 9));
  assert.equal(intervalMinutes('20'), 20); assert.equal(intervalMinutes('5'), 10);
  assert.throws(() => thesisText('tiny')); assert.throws(() => thesisText('a'.repeat(1201)));
  assert.equal(thesisText('  Test thesis\nwith data  '), 'Test thesis with data');
  assert.throws(() => tradeInput({ mint: 'test', side: 'hack', amount: '1', thesis: 'A test thesis.', slippageBps: 100 }, String));
});
test('only the reviewed message signed by the project wallet is accepted', () => {
  const signer = Keypair.generate(), other = Keypair.generate();
  const build = lamports => new VersionedTransaction(new TransactionMessage({ payerKey: signer.publicKey, recentBlockhash: other.publicKey.toBase58(), instructions: [SystemProgram.transfer({ fromPubkey: signer.publicKey, toPubkey: other.publicKey, lamports })] }).compileToV0Message());
  const tx = build(1), row = { wallet: signer.publicKey.toBase58(), transaction_message: Buffer.from(tx.message.serialize()).toString('base64') };
  assert.throws(() => verifySignedTransaction(Buffer.from(tx.serialize()).toString('hex'), row));
  tx.sign([signer]); assert.ok(verifySignedTransaction(Buffer.from(tx.serialize()).toString('hex'), row).signature);
  const changed = build(2); changed.sign([signer]);
  assert.throws(() => verifySignedTransaction(Buffer.from(changed.serialize()).toString('hex'), row));
  assert.throws(() => verifySignedTransaction(Buffer.from(tx.serialize()).toString('hex'), { ...row, wallet: other.publicKey.toBase58() }));
  assert.throws(() => verifySignedTransaction('not-hex', row));
});
test('login throttle uses atomic persistent counters and fails closed on storage errors', async () => {
  const original = globalThis.fetch, counts = new Map(), queries = JSON.parse(readFileSync(new URL('../supabase/functions/her-database/queries.json', import.meta.url)));
  globalThis.fetch = async (_, init) => {
    const { statements } = JSON.parse(init.body);
    return Response.json({ results: statements.map(({ query, values }) => {
      assert.ok(queries.includes(query), `SQL allowlisted: ${query}`);
      const attempts = query.startsWith('INSERT') ? (counts.get(values[0]) || 0) + 1 : 0;
      if (attempts) counts.set(values[0], attempts);
      return { results: attempts ? [{ attempts }] : [], meta: { changes: 1 } };
    }) });
  };
  try {
    await withDatabase('https://user:mock@localhost/db', async () => {
      for (let i = 0; i < 10; i++) assert.equal(await store.loginAllowed('ip'), true);
      assert.equal(await store.loginAllowed('ip'), false);
      globalThis.fetch = async () => { throw new Error('offline'); };
      await assert.rejects(store.loginAllowed('another-ip'));
    });
  } finally { globalThis.fetch = original; }
});
test('operator API rejects unknown keys, missing sessions and cross-origin mutations without network', async () => {
  const prior = { ...process.env }, fetch = globalThis.fetch;
  Object.assign(process.env, { HER_OPERATOR_ENABLED: 'true', HER_OPERATOR_PATH_KEY: key, HER_OPERATOR_PASSWORD_HASH: hash, HER_OPERATOR_SESSION_SECRET: secret });
  globalThis.fetch = async () => { throw new Error('No network permitted in guard tests'); };
  const context = { params: Promise.resolve({ key }) };
  try {
    const url = `http://localhost:1234/operator/${key}/api`;
    assert.equal((await route.GET(new Request(url), { params: Promise.resolve({ key: 'c'.repeat(64) }) })).status, 404);
    assert.equal((await route.GET(new Request(url), context)).status, 401);
    assert.equal((await route.POST(new Request(url, { method: 'POST', headers: { Origin: 'https://evil.example', 'Content-Type': 'application/json' }, body: '{}' }), context)).status, 403);
    assert.equal((await route.POST(new Request(url, { method: 'POST', headers: { Origin: 'http://localhost:1234', 'Content-Type': 'application/json' }, body: '{"action":"prepare"}' }), context)).status, 401);
    process.env.HER_OPERATOR_ENABLED = 'false';
    assert.equal((await route.GET(new Request(url), context)).status, 404);
  } finally { for (const name of Object.keys(process.env)) if (!(name in prior)) delete process.env[name]; Object.assign(process.env, prior); globalThis.fetch = fetch; }
});
test('operators choose the buy amount and execute submits a signed order only once', async () => {
  const signer = Keypair.generate(), coin = Keypair.generate().publicKey.toBase58(), blockhash = Keypair.generate().publicKey.toBase58();
  const tx = new VersionedTransaction(new TransactionMessage({ payerKey: signer.publicKey, recentBlockhash: blockhash, instructions: [SystemProgram.transfer({ fromPubkey: signer.publicKey, toPubkey: new Keypair().publicKey, lamports: 1 })] }).compileToV0Message());
  const unsigned = Buffer.from(tx.serialize()).toString('base64'), who = signer.publicKey.toBase58();
  const original = globalThis.fetch, prior = { ...process.env }; let row, submits = 0, excessiveSlippage = false;
  Object.assign(process.env, { HER_OPERATOR_ENABLED: 'true', HER_OPERATOR_TRADING_ENABLED: 'true', HER_WALLET_TRACKING_ENABLED: 'true', HER_WALLET_ADDRESS: who, HER_WALLET_PRIVATE_KEY: bs58.encode(signer.secretKey), HELIUS_API_KEY: 'mock-key', JUPITER_API_KEY: 'mock-key' });
  const allowed = JSON.parse(readFileSync(new URL('../supabase/functions/her-database/queries.json', import.meta.url)));
  globalThis.fetch = async (url, init) => {
    const parsed = new URL(url);
    if (parsed.hostname === 'mkewxmunkqsyziatkqfz.supabase.co') {
      return Response.json({ results: JSON.parse(init.body).statements.map(({ query, values }) => {
        assert.ok(allowed.includes(query)); let results = [];
        if (query.startsWith('INSERT INTO her_private.operator_orders')) row = Object.fromEntries(['id','wallet','mint','side','amount','thesis','token_name','symbol','decimals','request_id','transaction_message','unsigned_transaction','out_amount','expires','created_at','status'].map((key, index) => [key, values[index]]));
        if (query.startsWith('SELECT * FROM her_private.operator_orders')) results = row ? [{ ...row }] : [];
        if (query.includes("SET status = 'submitting'")) { if (row.status === 'prepared') { row.status = 'submitting'; row.signature = values[0]; results = [{ id: row.id }]; } }
        if (query.startsWith('UPDATE') && query.includes('SET status = ?')) row.status = values[0];
        return { results, meta: { changes: 1 } };
      }) });
    }
    if (parsed.hostname === 'mainnet.helius-rpc.com') {
      const request = JSON.parse(init.body); assert.equal(request.method, 'getAsset');
      return Response.json({ result: { id: coin, interface: 'FungibleToken', token_info: { decimals: 6, symbol: 'TEST' }, content: { metadata: { name: 'Test coin' } } } });
    }
    assert.equal(parsed.hostname, 'api.jup.ag');
    if (parsed.pathname.endsWith('/order')) {
      assert.equal(parsed.searchParams.get('amount'), '1000000000');
      return Response.json({ transaction: unsigned, requestId: 'test-request', inputMint: trading.SOL_MINT, outputMint: coin, inAmount: parsed.searchParams.get('amount'), outAmount: '2000000', slippageBps: excessiveSlippage ? 500 : 100, feeBps: 10 });
    }
    assert.ok(parsed.pathname.endsWith('/execute')); submits++;
    return Response.json({ status: 'Success', signature: verifySignedTransaction(Buffer.from(VersionedTransaction.deserialize(Buffer.from(JSON.parse(init.body).signedTransaction, 'base64')).serialize()).toString('hex'), row).signature });
  };
  try {
    await withDatabase('https://user:mock@localhost/db', async () => {
      assert.equal(trading.tradingReady(), true);
      const input = { mint: coin, side: 'buy', amount: '1', thesis: 'A synthetic unit test thesis.', slippageBps: 100 };
      excessiveSlippage = true; await assert.rejects(trading.prepareTrade(who, input), /No supported swap route/); excessiveSlippage = false;
      const quote = await trading.prepareTrade(who, input); assert.equal(quote.expectedOutput, '2'); assert.equal(quote.amount, '1'); assert.equal(row.amount, '1');
      assert.equal('transaction' in quote, false);
      assert.equal((await trading.executeTrade(who, quote.id)).status, 'submitted');
      assert.equal((await trading.executeTrade(who, quote.id)).status, 'submitted'); assert.equal(submits, 1);
      process.env.HER_OPERATOR_TRADING_ENABLED = 'false';
      await assert.rejects(trading.executeTrade(who, quote.id), /Trading is disabled/); assert.equal(submits, 1);
    });
  } finally { globalThis.fetch = original; for (const name of Object.keys(process.env)) if (!(name in prior)) delete process.env[name]; Object.assign(process.env, prior); }
});
test('backend keys must be 64-byte keys matching the project wallet and sign only the reviewed message', () => {
  const signer = Keypair.generate(), other = Keypair.generate(), who = signer.publicKey.toBase58();
  const secret = bs58.encode(signer.secretKey);
  assert.equal(backendSigner(secret, who).publicKey.toBase58(), who);
  assert.equal(backendSigner(JSON.stringify([...signer.secretKey]), who).publicKey.toBase58(), who);
  assert.equal(signerConfigured(secret, other.publicKey.toBase58()), false);
  for (const bad of ['', 'invalid', JSON.stringify([1, 2, 3]), bs58.encode(new Uint8Array(32))]) assert.throws(() => backendSigner(bad, who), /Backend signer/);
  const tx = new VersionedTransaction(new TransactionMessage({ payerKey: signer.publicKey, recentBlockhash: other.publicKey.toBase58(), instructions: [] }).compileToV0Message());
  const row = { wallet: who, transaction_message: Buffer.from(tx.message.serialize()).toString('base64'), unsigned_transaction: Buffer.from(tx.serialize()).toString('hex') };
  assert.ok(signReviewedOrder(secret, row).signature);
  assert.throws(() => signReviewedOrder(secret, { ...row, transaction_message: 'tampered' }), /reviewed order/);
  assert.throws(() => signReviewedOrder(secret, { ...row, wallet: other.publicKey.toBase58() }), /Backend signer/);
});
test('disabled preview can authenticate without database access, but all mutations stay closed', async () => {
  const prior = { ...process.env }, original = globalThis.fetch;
  Object.assign(process.env, { HER_OPERATOR_ENABLED: 'true', HER_OPERATOR_PATH_KEY: key, HER_OPERATOR_PASSWORD_HASH: hash, HER_OPERATOR_SESSION_SECRET: secret, HER_OPERATOR_TRADING_ENABLED: 'false', HER_WALLET_TRACKING_ENABLED: 'false', HER_WALLET_ADDRESS: '', DATABASE_URL: '' });
  globalThis.fetch = async () => { throw new Error('Preview must not contact providers or storage'); };
  const url = `http://localhost:1234/operator/${key}/api`, context = { params: Promise.resolve({ key }) };
  try {
    const response = await route.POST(new Request(url, { method: 'POST', headers: { Origin: 'http://localhost:1234', 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'login', password }) }), context);
    assert.equal(response.status, 200); const cookie = response.headers.get('set-cookie').split(';')[0];
    const state = await route.GET(new Request(url, { headers: { Cookie: cookie } }), context);
    assert.equal(state.status, 200); const body = await state.json();
    assert.equal(body.preview, true); assert.equal(body.trading, false); assert.equal(body.signerConfigured, false);
    for (const action of ['prepare', 'execute', 'thesis']) {
      const denied = await route.POST(new Request(url, { method: 'POST', headers: { Origin: 'http://localhost:1234', Cookie: cookie, 'Content-Type': 'application/json' }, body: JSON.stringify({ action }) }), context);
      assert.equal(denied.status, 403);
    }
    for (let i = 0; i < 10; i++) assert.equal(previewLoginAllowed('test-preview-ip', 1700000000000), true);
    assert.equal(previewLoginAllowed('test-preview-ip', 1700000000000), false);
  } finally { globalThis.fetch = original; for (const name of Object.keys(process.env)) if (!(name in prior)) delete process.env[name]; Object.assign(process.env, prior); }
});
test('reporting feed retains the coin ticker and thesis when SOL is also held', async () => {
  const wallet = '1'.repeat(32), mint = '2'.repeat(32), signature = '3'.repeat(88);
  const prior = { ...process.env }, original = globalThis.fetch;
  Object.assign(process.env, { HER_OPERATOR_ENABLED: 'true', HER_WALLET_ADDRESS: wallet, HELIUS_API_KEY: 'reporting-mock', HER_POSITION_UPDATE_MINUTES: '15' });
  globalThis.fetch = async (url, init) => {
    const parsed = new URL(url);
    if (parsed.hostname === 'mkewxmunkqsyziatkqfz.supabase.co') return Response.json({ results: JSON.parse(init.body).statements.map(({ query }) => ({ results: query.includes('operator_notes') ? [{ mint, thesis: 'A preserved test position thesis.', updated_at: Date.now() }] : [], meta: { changes: 0 } })) });
    if (parsed.pathname.endsWith('/balances')) return Response.json({ balances: [{ mint: 'SOL', name: 'Solana', symbol: 'SOL', balance: 1 }, { mint, name: 'Test coin', symbol: 'TEST', balance: 2 }], pagination: { hasMore: false } });
    if (parsed.pathname.endsWith('/history')) return Response.json({ data: [{ signature, error: null, feePayer: wallet, timestamp: Math.floor(Date.now() / 1000), balanceChanges: [{ mint: 'SOL', amount: -0.1 }, { mint, amount: 2 }] }], pagination: { hasMore: false } });
    assert.equal(JSON.parse(init.body).method, 'getSignatureStatuses');
    return Response.json({ result: { value: [{ err: null, confirmationStatus: 'confirmed' }] } });
  };
  try {
    const result = await withDatabase('https://user:mock@localhost/db', reportingFeed);
    assert.equal(result.trades[0].token.symbol, 'TEST');
    assert.equal(result.trades[0].thesis, 'A preserved test position thesis.');
    assert.equal(result.updateIntervalMinutes, 15);
    const { walletFeed } = await import('../../her/lib/wallet-updates.ts');
    const boundary = walletFeed(result);
    assert.equal(boundary.trades[0].token.symbol, 'TEST');
    assert.equal(boundary.positions.length, 1);
    assert.equal(boundary.positions[0].thesis, 'A preserved test position thesis.');
  } finally { globalThis.fetch = original; for (const name of Object.keys(process.env)) if (!(name in prior)) delete process.env[name]; Object.assign(process.env, prior); }
});
