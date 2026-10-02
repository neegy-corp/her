export const STARTING_SOL = 3;
export type TradePosition = {
  mint: string; name: string; symbol: string; logo: string | null;
  amount: number; bought: boolean; priceQuote: number | null; valueSol: number | null;
  costSol: number | null; realizedSol: number | null; unrealizedSol: number | null;
  pnlSol: number | null; pnlPercent: number | null; boughtSol: number;
};
export type PublicTrade = {
  signature: string; timestamp: number; mint: string; side: 'buy' | 'sell';
  amount: number; solAmount: number; name: string; symbol: string; logo: string | null;
};
export type TradesSnapshot = {
  status: 'paused' | 'unconfigured' | 'unavailable' | 'live'; readOnly: true;
  wallet: string | null; observedAt: number | null; startingSol: number;
  solBalance: number | null; wrappedSolBalance: number | null;
  equitySol: number | null; equityQuote: number | null; solPriceQuote: number | null; quoteCurrency: 'USD' | 'USDC' | null;
  pnlSol: number | null; pnlPercent: number | null;
  realizedSol: number | null; unrealizedSol: number | null;
  positions: TradePosition[]; activity: PublicTrade[];
  warnings: ('history_incomplete' | 'prices_missing' | 'basis_missing' | 'unsupported_activity' | 'funding_pending')[];
};
export function emptyTrades(status: TradesSnapshot['status']): TradesSnapshot {
  return { status, readOnly: true, wallet: null, observedAt: null, startingSol: STARTING_SOL,
    solBalance: null, wrappedSolBalance: null, equitySol: null, equityQuote: null, solPriceQuote: null, quoteCurrency: null,
    pnlSol: null, pnlPercent: null, realizedSol: null, unrealizedSol: null, positions: [], activity: [], warnings: [] };
}
