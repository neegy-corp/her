export type TradeInput = { mint: string; side: 'buy' | 'sell'; amount: string; thesis: string; slippageBps: number };
export function thesisText(value: unknown) {
  if (typeof value !== 'string') throw new Error('Enter a thesis.');
  const text = value.replace(/[\u0000-\u001f\u007f]/g, ' ').trim();
  if (text.length < 10 || text.length > 1200) throw new Error('Thesis must be 10 to 1,200 characters.');
  return text;
}
export function units(value: unknown, decimals: number) {
  if (typeof value !== 'string' || !/^\d{1,20}(\.\d{1,18})?$/.test(value) || !Number.isInteger(decimals) || decimals < 0 || decimals > 18) throw new Error('Enter a positive decimal amount.');
  const [whole, fraction = ''] = value.split('.');
  if (fraction.length > decimals) throw new Error(`Amount supports at most ${decimals} decimal places.`);
  const raw = BigInt(whole) * 10n ** BigInt(decimals) + BigInt(fraction.padEnd(decimals, '0') || '0');
  if (raw <= 0n || raw > 18446744073709551615n) throw new Error('Amount is outside the supported range.');
  return raw.toString();
}
export function decimal(raw: string, decimals: number) {
  if (!/^\d+$/.test(raw) || !Number.isInteger(decimals) || decimals < 0 || decimals > 18) throw new Error('Invalid token amount.');
  if (!decimals) return raw;
  const padded = raw.padStart(decimals + 1, '0');
  return `${padded.slice(0, -decimals)}.${padded.slice(-decimals)}`.replace(/\.?0+$/, '');
}
export function tradeInput(body: Record<string, unknown>, validateAddress: (value: unknown) => string): TradeInput {
  const mint = validateAddress(body.mint);
  if (!['buy', 'sell'].includes(String(body.side))) throw new Error('Choose Buy or Sell.');
  const slippageBps = body.slippageBps;
  if (typeof slippageBps !== 'number' || !Number.isInteger(slippageBps) || slippageBps < 10 || slippageBps > 300) throw new Error('Slippage must be between 0.1% and 3%.');
  if (typeof body.amount !== 'string') throw new Error('Enter an amount.');
  units(body.amount, 18);
  return { mint, side: body.side as TradeInput['side'], amount: body.amount, thesis: thesisText(body.thesis), slippageBps };
}
export function intervalMinutes(value: unknown) { const parsed = Number(value); return Number.isInteger(parsed) && parsed >= 10 && parsed <= 20 ? parsed : 10; }
