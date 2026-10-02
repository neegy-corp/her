import { SOL } from './paper-engine.mjs';
const MINT = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;
async function json(url, headers, fetcher) {
  const response = await fetcher(url, { method: 'GET', headers, redirect: 'error', signal: AbortSignal.timeout(15_000) });
  if (!response.ok) throw new Error('Market data unavailable.');
  const text = await response.text();
  if (text.length > 2_000_000) throw new Error('Market response too large.');
  return JSON.parse(text);
}
export function market(apiKey, excludedMints = [], fetcher = fetch) {
  if (typeof apiKey !== 'string' || !apiKey.trim()) throw new Error('Jupiter quote API key required.');
  return {
    excludedMints,
    now: Date.now,
    async discover() {
      // Search is sampled, not a full Pump launch index. Paid profiles/boosts are not signals.
      const results = await Promise.all(['pumpfun', 'pumpswap'].map(q => json(`https://api.dexscreener.com/latest/dex/search?q=${q}`, {}, fetcher)));
      if (results.some(body => !Array.isArray(body.pairs))) throw new Error('Invalid discovery response.');
      return results.flatMap(body => body.pairs);
    },
    async quote(inputMint, outputMint, amount) {
      if (!MINT.test(inputMint) || !MINT.test(outputMint) || (inputMint !== SOL && outputMint !== SOL) || !/^\d{1,20}$/.test(amount) || BigInt(amount) <= 0n || BigInt(amount) > 18446744073709551615n) throw new Error('Invalid quote request.');
      const url = new URL('https://api.jup.ag/swap/v2/order');
      // No taker, payer, transaction build, signature or execute request exists here.
      url.search = new URLSearchParams({ inputMint, outputMint, amount, excludeRouters: 'jupiterz' }).toString();
      const body = await json(url, { 'x-api-key': apiKey }, fetcher);
      if (body.errorCode || body.transaction || body.inputMint !== inputMint || body.outputMint !== outputMint || body.inAmount !== amount || !/^\d{1,20}$/.test(body.outAmount) || BigInt(body.outAmount) <= 0n) throw new Error('Invalid quote response.');
      return { outAmount: body.outAmount, at: Date.now() };
    },
  };
}
