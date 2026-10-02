import { address, setting } from './server';
import { createWalletReader } from './wallet-reader';
import { intervalMinutes } from './operator-input';
import { notes, orders, reconcile } from './operator-store';
import { orderReceipt } from './operator-receipt';

let current: { wallet: string; apiKey: string; reader: ReturnType<typeof createWalletReader> } | undefined;
export function walletReader() {
  const wallet = address(setting('HER_WALLET_ADDRESS'));
  const apiKey = setting('HELIUS_API_KEY');
  if (!current || current.wallet !== wallet || current.apiKey !== apiKey) current = { wallet, apiKey, reader: createWalletReader({ wallet, apiKey }) };
  return current.reader;
}
export async function reportingFeed() {
  const reader = walletReader();
  const portfolio = await reader.portfolio();
  let verifiedTrades = [...portfolio.trades];
  // Operator data is optional for the original read-only tracker, but required
  // once the panel is enabled. Fail closed rather than speak without context.
  if (setting('HER_OPERATOR_ENABLED') === 'true') {
    const pending = (await orders(portfolio.wallet)).filter(order => (['submitting', 'submitted', 'unknown'].includes(order.status) || order.status === 'confirmed' && order.created_at > Date.now() - 120000) && order.signature && order.created_at > Date.now() - 86400000 && !verifiedTrades.some(trade => trade.signature === order.signature)).slice(0, 5);
    const receipts = await Promise.all(pending.map(async order => orderReceipt(await reader.transaction(order.signature!).catch(() => null), portfolio.wallet, order)));
    verifiedTrades = [...verifiedTrades, ...receipts.flatMap(receipt => receipt ? [receipt] : [])].sort((a, b) => b.timestamp - a.timestamp).slice(0, 20);
    await reconcile(portfolio.wallet, verifiedTrades);
  }
  const thoughts = setting('HER_OPERATOR_ENABLED') === 'true' ? await notes(portfolio.wallet) : [];
  const journal = setting('HER_OPERATOR_ENABLED') === 'true' ? await orders(portfolio.wallet) : [];
  const metadata = new Map<string, { mint: string; name: string; symbol?: string }>();
  for (const position of portfolio.positions) if (position.name || position.symbol) metadata.set(position.mint, position);
  // Resolve only newly reportable coins, not an entire old history page.
  for (const trade of verifiedTrades.filter(trade => trade.timestamp >= Date.now() - 120000).slice(0, 3)) {
    const assets = trade.changes.filter(change => !['SOL', 'So11111111111111111111111111111111111111112', 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v'].includes(change.mint));
    if (assets.length === 1 && !metadata.has(assets[0].mint)) {
      const token = await reader.metadata(assets[0].mint).catch(() => null);
      if (token) metadata.set(token.mint, token);
    }
  }
  const trades = verifiedTrades.map(trade => {
    const assets = trade.changes.filter(change => !['SOL', 'So11111111111111111111111111111111111111112', 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v'].includes(change.mint) && metadata.has(change.mint));
    const details = assets.length === 1 ? metadata.get(assets[0].mint) : undefined;
    const token = details ? { mint: details.mint, name: details.name, symbol: details.symbol || '' } : undefined;
    return { ...trade, ...(token ? { token, thesis: journal.find(order => order.signature === trade.signature && order.status === 'confirmed')?.thesis || thoughts.find(note => note.mint === token.mint)?.thesis || '' } : {}) };
  });
  return { ...portfolio, trades, updateIntervalMinutes: intervalMinutes(setting('HER_POSITION_UPDATE_MINUTES')), positions: portfolio.positions.map(position => ({ ...position, thesis: thoughts.find(note => note.mint === position.mint)?.thesis || '' })) };
}
