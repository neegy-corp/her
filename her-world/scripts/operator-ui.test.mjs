import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
require('@next/env').loadEnvConfig(process.cwd());
const { chromium } = require(process.env.HER_PLAYWRIGHT_MODULE || 'playwright');
const origin = process.env.HER_OPERATOR_TEST_ORIGIN || 'http://127.0.0.1:5190';
if (!/^http:\/\/(localhost|127\.0\.0\.1):\d+$/.test(origin)) throw new Error('UI tests must target an isolated local preview.');
const key = process.env.HER_OPERATOR_PATH_KEY, path = `/operator/${key}`;
if (!/^[a-f0-9]{64}$/.test(key || '') || !process.env.HER_OPERATOR_LOGIN_PASSWORD) throw new Error('Local preview credentials are required.');
const wallet = '1'.repeat(32), mint = '2'.repeat(32), thesis = 'Synthetic QA thesis: a community coin with a clear narrative; liquidity remains a risk.';
const state = { authenticated: true, wallet, tracking: true, trading: true, signerConfigured: true, preview: false, intervalMinutes: 10, notes: [{ mint, thesis }], orders: [{ id: 'test-order', mint, side: 'buy', amount: '0.1', token_name: 'Synthetic QA Coin', symbol: 'TEST', status: 'confirmed', signature: '3'.repeat(88), created_at: 1700000000000 }], feed: { observedAt: Date.now(), holdingsTruncated: false, positions: [{ mint, amount: 20000, name: 'Synthetic QA Coin', symbol: 'TEST', priceUsd: 0.0001, valueUsd: 2, thesis }] } };
const output = process.env.HER_OPERATOR_SCREENSHOT_DIR || '.impeccable/review';
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ channel: 'msedge', headless: true });
const errors = [];
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  page.on('pageerror', error => errors.push(error.message));
  // Real local server security headers and closed production gates, no mocks.
  const unknown = await page.request.get(`${origin}/operator/${'c'.repeat(64)}`);
  assert.equal(unknown.status(), 404);
  const anonymous = await page.request.get(`${origin}${path}/api`);
  assert.equal(anonymous.status(), 401);
  assert.match(anonymous.headers()['cache-control'], /no-store/);
  const protectedPage = await page.request.get(`${origin}${path}`);
  assert.equal(protectedPage.headers()['x-frame-options'], 'DENY');
  assert.equal(protectedPage.headers()['referrer-policy'], 'no-referrer');
  await page.goto(`${origin}${path}`, { waitUntil: 'networkidle' });
  await page.getByRole('heading', { name: 'Operator Access' }).waitFor();
  await page.getByLabel('Password', { exact: true }).fill(process.env.HER_OPERATOR_LOGIN_PASSWORD);
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await page.getByRole('heading', { name: 'Wallet Desk' }).waitFor();
  await page.addStyleTag({ content: 'nextjs-portal { display: none !important; }' });
  assert.equal(await page.getByRole('button', { name: 'Review buy', exact: true }).isEnabled(), false);
  const actual = await (await page.request.get(`${origin}${path}/api`)).json();
  assert.equal(actual.preview, true);
  assert.equal(actual.trading, false);
  assert.equal(actual.tracking, false);
  const blocked = await page.request.post(`${origin}${path}/api`, { headers: { Origin: origin }, data: { action: 'prepare' } });
  assert.equal(blocked.status(), 403);
  await page.screenshot({ path: `${output}/operator-paused-desktop.png`, fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: `${output}/operator-paused-mobile.png`, fullPage: true });
  await page.setViewportSize({ width: 1440, height: 1000 });
  const externalRequests = [];
  let authenticated = true;
  await page.route('**/*', async route => {
    const url = new URL(route.request().url());
    if (url.origin !== origin) { externalRequests.push(url.origin); return route.abort(); }
    if (url.pathname === `${path}/api`) {
      const body = route.request().postDataJSON();
      if (body?.action === 'logout') { authenticated = false; return route.fulfill({ json: { ok: true } }); }
      if (body?.action === 'thesis') { assert.equal(body.mint, mint); return route.fulfill({ json: { ok: true } }); }
      if (body?.action === 'prepare') { assert.equal(body.amount, '0.1'); assert.equal(body.thesis, thesis); return route.fulfill({ json: { id: 'test-order', token: { mint, name: 'Synthetic QA Coin', symbol: 'TEST', decimals: 6 }, side: 'buy', amount: '0.1', expectedOutput: '20000', outputSymbol: 'TEST', slippageBps: 100, feeBps: 10, expires: Date.now() + 60000 } }); }
      if (body?.action === 'execute') { assert.deepEqual(body, { action: 'execute', id: 'test-order' }); return route.fulfill({ json: { status: 'submitted', signature: '3'.repeat(88) } }); }
      if (url.searchParams.get('action') === 'token') return route.fulfill({ json: { mint, name: 'Synthetic QA Coin', symbol: 'TEST', decimals: 6 } });
      return route.fulfill({ json: authenticated ? state : { authenticated: false, configured: false }, status: authenticated ? 200 : 401 });
    }
    if (url.pathname === '/api/her') {
      return route.fulfill({ json: url.searchParams.get('action') === 'me' ? { wallet, isHost: false, receipts: [], requests: [], unlocks: [] } : { enabled: false, stageEnabled: false, mint: '', symbol: 'HER', turnkeyOrganizationId: '', turnkeyAuthProxyConfigId: '' } });
    }
    return route.continue();
  });
  await page.goto(`${origin}${path}`, { waitUntil: 'networkidle' });
  await page.getByRole('heading', { name: 'Wallet Desk' }).waitFor();
  await page.addStyleTag({ content: 'nextjs-portal { display: none !important; }' });
  assert.equal(await page.locator('.op-summary > div').count(), 3);
  assert.equal(await page.getByText('Buy limit', { exact: true }).count(), 0);
  await page.getByLabel('Contract Address', { exact: true }).fill(mint);
  await page.getByRole('button', { name: 'Look up coin', exact: true }).click();
  await page.getByText('Synthetic QA Coin', { exact: true }).first().waitFor();
  await page.getByLabel('Spend (SOL)', { exact: true }).fill('0.1');
  await page.getByRole('button', { name: 'Review buy', exact: true }).click();
  await page.getByRole('heading', { name: 'Review Order', exact: true }).waitFor();
  assert.equal(await page.getByRole('button', { name: 'Confirm trade', exact: true }).isEnabled(), false);
  await page.getByRole('checkbox').check();
  assert.equal(await page.getByRole('button', { name: 'Confirm trade', exact: true }).isEnabled(), true);
  await page.screenshot({ path: `${output}/operator-desktop.png`, fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: `${output}/operator-mobile.png`, fullPage: true });
  for (const width of [320, 390, 768, 1024, 1440]) {
    await page.setViewportSize({ width, height: width === 390 ? 844 : 1000 });
    const layout = await page.evaluate(() => ({ width: innerWidth, scroll: document.documentElement.scrollWidth, images: [...document.querySelectorAll('.op-page img')].map(image => image.complete && image.naturalWidth > 0), controls: [...document.querySelectorAll('.op-page button')].filter(button => button.getBoundingClientRect().width > 0).map(button => ({ width: button.clientWidth, scroll: button.scrollWidth })) }));
    assert.ok(layout.scroll <= layout.width, `No page overflow at ${width}`);
    assert.ok(layout.images.every(Boolean), 'Brand asset rendered');
    assert.ok(layout.controls.every(control => control.scroll <= control.width + 1), 'Button labels fit');
  }
  await page.getByRole('button', { name: 'Confirm trade', exact: true }).click();
  await page.getByRole('status').filter({ hasText: 'Submitted. Awaiting confirmed wallet activity.' }).waitFor();
  await page.getByRole('button', { name: 'Save thesis', exact: true }).click();
  await page.getByRole('status').filter({ hasText: 'Thesis saved.' }).waitFor();
  await page.getByRole('button', { name: 'Sell', exact: true }).click();
  await page.getByLabel('Sell (TEST)', { exact: true }).waitFor();
  assert.equal(await page.getByLabel('Sell (TEST)', { exact: true }).inputValue(), '');
  await page.getByRole('button', { name: 'Sign out', exact: true }).click();
  await page.getByRole('heading', { name: 'Operator Access', exact: true }).waitFor();
  assert.equal(await page.getByRole('button', { name: 'Sign in', exact: true }).isEnabled(), false);
  assert.deepEqual(errors, []);
  assert.ok(externalRequests.every(url => url === 'https://fonts.googleapis.com' || url === 'https://fonts.gstatic.com'), 'Only existing font URLs were attempted; all external requests were blocked.');
  console.log('PASS: Edge desktop/mobile layout, actual disabled preview login, mutation guards, private headers, synthetic coin lookup, stored-ID-only confirmation, thesis save, side switch and logout. No real trades.');
} finally { await browser.close(); }
