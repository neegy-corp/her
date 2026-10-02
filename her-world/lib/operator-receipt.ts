import type { WalletTrade } from './wallet-reader';

const object = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object' && !Array.isArray(value);
// Fallback for our own signed orders when the Helius SWAP parser has not
// indexed a route yet. Use confirmed chain deltas, never the expected quote.
export function orderReceipt(value: unknown, wallet: string, order: { signature: string | null; mint: string; side: 'buy' | 'sell' }): WalletTrade | null {
  if (!order.signature || !object(value) || !Number.isSafeInteger(value.blockTime) || Number(value.blockTime) <= 0 || !object(value.meta) || value.meta.err !== null || !object(value.transaction) || !object(value.transaction.message)) return null;
  const meta = value.meta, message = value.transaction.message;
  if (!Array.isArray(message.accountKeys) || message.accountKeys[0] !== wallet || !Array.isArray(value.transaction.signatures) || value.transaction.signatures[0] !== order.signature || !Array.isArray(meta.preBalances) || !Array.isArray(meta.postBalances) || !Number.isSafeInteger(meta.preBalances[0]) || !Number.isSafeInteger(meta.postBalances[0]) || !Array.isArray(meta.preTokenBalances) || !Array.isArray(meta.postTokenBalances)) return null;
  let decimals: number | undefined;
  function sum(rows: unknown[]) {
    let amount = 0n;
    for (const row of rows) {
      if (!object(row) || row.owner !== wallet || row.mint !== order.mint) continue;
      const token = row.uiTokenAmount;
      if (!object(token) || typeof token.amount !== 'string' || !/^\d{1,20}$/.test(token.amount) || !Number.isInteger(token.decimals) || Number(token.decimals) < 0 || Number(token.decimals) > 18 || (decimals !== undefined && decimals !== token.decimals)) throw new Error('Invalid receipt balance.');
      decimals = Number(token.decimals); amount += BigInt(token.amount);
    }
    return amount;
  }
  try {
    const before = sum(meta.preTokenBalances), after = sum(meta.postTokenBalances);
    if (decimals === undefined) return null;
    const tokens = Number(after - before) / 10 ** decimals;
    const sol = (meta.postBalances[0] - meta.preBalances[0]) / 1e9;
    if (!Number.isFinite(tokens) || !Number.isFinite(sol) || (order.side === 'buy' ? tokens <= 0 || sol >= 0 : tokens >= 0 || sol <= 0)) return null;
    return { signature: order.signature, timestamp: Number(value.blockTime) * 1000, confirmation: 'confirmed', side: order.side, changes: [{ mint: 'SOL', amount: sol }, { mint: order.mint, amount: tokens }] };
  } catch { return null; }
}
