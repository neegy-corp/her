// Simulation only. This module has no wallet, signer, transaction or execution API.
export const SOL = 'So11111111111111111111111111111111111111112';
const MINUTE = 60_000;
const FEE = 10_000n; // Explicit simulated network-cost assumption per side.
const SLIPPAGE_BPS = 100n;
const clean = (value) => String(value ?? '').replace(/[\u0000-\u001f\u007f]/g, '').slice(0, 60);
export function lamports(value) {
  if (typeof value !== 'string' || !/^(0|[1-9]\d{0,8})(\.\d{1,9})?$/.test(value)) throw new Error('Use a positive SOL decimal string with at most 9 decimals.');
  const [whole, fraction = ''] = value.split('.');
  const result = BigInt(whole) * 1_000_000_000n + BigInt(fraction.padEnd(9, '0'));
  if (result <= 0n) throw new Error('Amount must be positive.');
  return result;
}
export function config(input) {
  if (input?.mode !== 'paper') throw new Error('Only paper mode is supported.');
  const trade = lamports(input.tradeSol), loss = lamports(input.dailyLossSol), capital = lamports(input.virtualCapitalSol);
  if (capital < trade + FEE || loss >= capital) throw new Error('Invalid simulated capital or loss limit.');
  return { mode: 'paper', tradeSol: input.tradeSol, dailyLossSol: input.dailyLossSol, virtualCapitalSol: input.virtualCapitalSol };
}
const day = (now) => new Date(now).toISOString().slice(0, 10);
export function initialState(settings, now) {
  const c = config(settings);
  return { version: 1, mode: 'paper', config: c, createdAt: now, updatedAt: now, day: day(now), cash: lamports(c.virtualCapitalSol).toString(), dayStartEquity: lamports(c.virtualCapitalSol).toString(), equity: lamports(c.virtualCapitalSol).toString(), halted: false, position: null, events: [], lastExit: 0, status: 'waiting-for-market-data' };
}
function event(s, now, data) {
  s.events.push({ ...data, at: now, mode: 'paper', simulated: true });
  s.events = s.events.slice(-1000);
}
function output(q, now) {
  if (!q || !/^\d{1,20}$/.test(q.outAmount) || BigInt(q.outAmount) <= 0n || !Number.isFinite(q.at) || now - q.at > 30_000 || q.at > now + 1000) throw new Error('Invalid or stale quote.');
  return BigInt(q.outAmount) * (10_000n - SLIPPAGE_BPS) / 10_000n;
}
// A deliberately simple, disclosed experiment, not a profitability claim.
export function candidates(pairs, now, exclude = new Set()) {
  if (!Array.isArray(pairs)) return [];
  const unique = new Map();
  for (const p of pairs) {
    const mint = p?.baseToken?.address;
    const age = now - p?.pairCreatedAt;
    const change = p?.priceChange?.m5;
    const hour = p?.priceChange?.h1;
    const liquidity = p?.liquidity?.usd;
    const volume = p?.volume?.m5;
    const buys = p?.txns?.m5?.buys, sells = p?.txns?.m5?.sells;
    if (p?.chainId !== 'solana' || !['pumpfun', 'pumpswap'].includes(p.dexId) || typeof mint !== 'string' || !/^[1-9A-HJ-NP-Za-km-z]{28,40}pump$/.test(mint) || exclude.has(mint)) continue;
    if (![age, change, hour, liquidity, volume, buys, sells].every(Number.isFinite) || age < 60 * MINUTE || liquidity < 25_000 || volume < 5000 || change < 1 || change > 10 || hour < 0 || buys < 10 || sells < 0 || buys < 1.2 * Math.max(sells, 1)) continue;
    const item = { mint, symbol: clean(p.baseToken.symbol), liquidity, volume, change, score: volume / liquidity };
    if (!unique.has(mint) || unique.get(mint).liquidity < liquidity) unique.set(mint, item);
  }
  return [...unique.values()].sort((a, b) => b.score - a.score || a.mint.localeCompare(b.mint)).slice(0, 10);
}
export async function tick(previous, settings, provider, now = Date.now()) {
  const c = config(settings);
  const s = structuredClone(previous);
  if (s?.version !== 1 || s.mode !== 'paper' || JSON.stringify(s.config) !== JSON.stringify(c)) throw new Error('Paper state/config mismatch; do not reset existing results silently.');
  if (!/^\d+$/.test(s.cash) || !/^\d+$/.test(s.dayStartEquity) || !Array.isArray(s.events) || s.updatedAt > now) throw new Error('Invalid paper journal or clock moved backwards.');
  const cash = BigInt(s.cash);
  let mark = 0n;
  if (s.position) {
    try {
      mark = output(await provider.quote(s.position.mint, SOL, s.position.units), provider.now?.() ?? now) - FEE;
      if (mark < 0n) mark = 0n;
    } catch {
      // No imaginary zero/last-price sale. Keep exposure and pause new entries.
      s.updatedAt = now; s.status = 'paused-unpriced-position'; s.equity = null;
      return s;
    }
  }
  let equity = cash + mark;
  if (s.day !== day(now)) {
    s.day = day(now); s.dayStartEquity = equity.toString(); s.halted = false;
    event(s, now, { type: 'day-baseline', equity: equity.toString() });
  }
  const dailyLimit = lamports(c.dailyLossSol);
  if (BigInt(s.dayStartEquity) - equity >= dailyLimit) s.halted = true;
  s.equity = equity.toString(); s.updatedAt = now;
  if (s.position) {
    const cost = BigInt(s.position.cost);
    const reason = s.halted ? 'daily-loss-limit' : mark * 100n <= cost * 90n ? 'stop-loss-10-percent' : mark * 100n >= cost * 120n ? 'take-profit-20-percent' : now - s.position.openedAt >= 30 * MINUTE ? 'maximum-hold-30-minutes' : null;
    if (!reason) { s.status = 'holding-paper-position'; return s; }
    event(s, now, { type: 'sell', mint: s.position.mint, symbol: s.position.symbol, proceeds: mark.toString(), pnl: (mark - cost).toString(), reason });
    s.cash = equity.toString(); s.position = null; s.lastExit = now;
    s.status = s.halted ? 'daily-loss-limit-reached' : 'cooldown';
    return s;
  }
  if (s.halted) { s.status = 'daily-loss-limit-reached'; return s; }
  if (now - s.lastExit < 5 * MINUTE) { s.status = 'cooldown'; return s; }
  const trade = lamports(c.tradeSol), cost = trade + FEE;
  if (cash < cost) { s.status = 'insufficient-virtual-cash'; return s; }
  // Require room for the nominal 10% exit plus fee/slippage assumptions.
  const headroom = dailyLimit - (BigInt(s.dayStartEquity) - equity);
  if (headroom < trade * 12n / 100n + 2n * FEE) { s.status = 'insufficient-loss-budget'; return s; }
  let pairs;
  try { pairs = await provider.discover(); }
  catch { s.status = 'paused-discovery-unavailable'; return s; }
  const selected = candidates(pairs, now, new Set(provider.excludedMints ?? []));
  s.candidates = selected.length;
  for (const coin of selected) {
    try {
      const units = output(await provider.quote(SOL, coin.mint, trade.toString()), provider.now?.() ?? now);
      if (units <= 0n) continue;
      // Require a fresh reverse route before entering. Neither quote is executable.
      const exit = output(await provider.quote(coin.mint, SOL, units.toString()), provider.now?.() ?? now) - FEE;
      if (exit <= 0n || cost - exit >= headroom || exit * 100n < cost * 95n) continue;
      s.cash = (cash - cost).toString();
      s.position = { mint: coin.mint, symbol: coin.symbol, units: units.toString(), cost: cost.toString(), openedAt: now };
      s.equity = (cash - cost + exit).toString();
      s.status = 'holding-paper-position';
      event(s, now, { type: 'buy', mint: coin.mint, symbol: coin.symbol, cost: cost.toString(), units: units.toString(), reason: 'experimental-pump-pool-momentum' });
      return s;
    } catch { /* An unavailable route skips the candidate, never implies a fill. */ }
  }
  s.status = selected.length ? 'waiting-for-acceptable-jupiter-route' : 'waiting-for-qualified-pool';
  return s;
}
