import { randomUUID } from 'node:crypto';
import { VersionedTransaction } from '@solana/web3.js';
import { setting } from './server';
import { walletReader } from './wallet-service';
import { claimOrder, insertOrder, order, submitted, type OperatorOrder } from './operator-store';
import { decimal, units, type TradeInput } from './operator-input';
import { signReviewedOrder, signerConfigured } from './operator-signer';

export const SOL_MINT = 'So11111111111111111111111111111111111111112';
export function tradingReady() {
  return setting('HER_OPERATOR_ENABLED') === 'true' && setting('HER_OPERATOR_TRADING_ENABLED') === 'true' && setting('HER_WALLET_TRACKING_ENABLED') === 'true' && !!setting('HELIUS_API_KEY') && !!setting('JUPITER_API_KEY') && signerConfigured(setting('HER_WALLET_PRIVATE_KEY'), setting('HER_WALLET_ADDRESS'));
}
async function jupiter(action: 'order' | 'execute', params: Record<string, string>) {
  const url = new URL(`https://api.jup.ag/swap/v2/${action}`);
  const headers = { 'x-api-key': setting('JUPITER_API_KEY'), 'Content-Type': 'application/json' };
  if (action === 'order') url.search = new URLSearchParams(params).toString();
  const response = await fetch(url, { method: action === 'order' ? 'GET' : 'POST', headers, ...(action === 'execute' ? { body: JSON.stringify(params) } : {}), cache: 'no-store', redirect: 'error', signal: AbortSignal.timeout(20000) });
  if (!response.ok) throw new Error('Swap provider is unavailable. Check the order before trying again.');
  const raw = await response.text();
  if (raw.length > 100000) throw new Error('Invalid swap provider response.');
  return JSON.parse(raw) as Record<string, unknown>;
}
export async function prepareTrade(wallet: string, input: TradeInput) {
  if (!tradingReady()) throw new Error('Trading is disabled or not configured.');
  if (wallet !== setting('HER_WALLET_ADDRESS')) throw new Error('Backend signer does not match the project wallet.');
  if (input.mint === SOL_MINT) throw new Error('Enter the coin mint, not wrapped SOL.');
  const token = await walletReader().metadata(input.mint);
  const raw = units(input.amount, input.side === 'buy' ? 9 : token.decimals);
  if (input.side === 'sell') {
    const held = BigInt(await walletReader().tokenBalance(input.mint));
    if (BigInt(raw) > held) throw new Error('Sell amount exceeds the wallet balance.');
  }
  const inputMint = input.side === 'buy' ? SOL_MINT : input.mint;
  const outputMint = input.side === 'buy' ? input.mint : SOL_MINT;
  const result = await jupiter('order', { inputMint, outputMint, amount: raw, taker: wallet, slippageBps: String(input.slippageBps), excludeRouters: 'jupiterz' });
  if (typeof result.transaction !== 'string' || !result.transaction || result.errorCode || typeof result.requestId !== 'string' || result.requestId.length > 256 || result.inputMint !== inputMint || result.outputMint !== outputMint || result.inAmount !== raw || typeof result.outAmount !== 'string' || !/^\d+$/.test(result.outAmount) || BigInt(result.outAmount) <= 0n || typeof result.slippageBps !== 'number' || result.slippageBps > input.slippageBps || result.slippageBps < 0) throw new Error('No supported swap route was returned for this coin. No trade was sent.');
  const tx = VersionedTransaction.deserialize(Buffer.from(result.transaction, 'base64'));
  if (tx.message.header.numRequiredSignatures !== 1 || tx.message.staticAccountKeys[0].toBase58() !== wallet) throw new Error('This route requires unsupported signing. No trade was sent.');
  const now = Date.now();
  const expiry = typeof result.expireAt === 'string' ? Date.parse(result.expireAt) : NaN;
  const row: OperatorOrder = { id: randomUUID(), wallet, mint: input.mint, side: input.side, amount: input.amount, thesis: input.thesis, token_name: token.name, symbol: token.symbol, decimals: token.decimals, request_id: result.requestId, transaction_message: Buffer.from(tx.message.serialize()).toString('base64'), unsigned_transaction: Buffer.from(tx.serialize()).toString('hex'), out_amount: result.outAmount, expires: Number.isFinite(expiry) ? Math.min(now + 60000, expiry) : now + 60000, created_at: now, status: 'prepared', signature: null };
  if (row.expires <= now) throw new Error('Quote expired. Request another quote.');
  await insertOrder(row);
  return { id: row.id, token, side: row.side, amount: row.amount, expectedOutput: decimal(row.out_amount, input.side === 'buy' ? token.decimals : 9), outputSymbol: input.side === 'buy' ? token.symbol || 'tokens' : 'SOL', slippageBps: input.slippageBps, feeBps: typeof result.feeBps === 'number' ? result.feeBps : null, expires: row.expires };
}
export async function executeTrade(wallet: string, id: string) {
  if (!tradingReady()) throw new Error('Trading is disabled.');
  if (wallet !== setting('HER_WALLET_ADDRESS')) throw new Error('Backend signer does not match the project wallet.');
  const row = await order(id, wallet);
  if (!row) throw new Error('Order was not found.');
  if (row.status !== 'prepared') return { id, status: row.status, signature: row.signature };
  if (row.expires <= Date.now()) throw new Error('Quote expired. Request another quote.');
  const signed = signReviewedOrder(setting('HER_WALLET_PRIVATE_KEY'), row);
  if (!await claimOrder(id, wallet, signed.signature)) throw new Error('Order already submitted or expired. Refresh activity.');
  // Claim once and persist the signature before the network call. An uncertain
  // response is never retried as a fresh trade; the chain feed reconciles it.
  try {
    const result = await jupiter('execute', { signedTransaction: signed.signedTransaction, requestId: row.request_id });
    const status = result.status === 'Success' && result.signature === signed.signature ? 'submitted' : result.status === 'Failed' ? 'failed' : 'unknown';
    await submitted(id, wallet, status);
    return { id, status, signature: signed.signature };
  } catch {
    await submitted(id, wallet, 'unknown');
    return { id, status: 'unknown', signature: signed.signature };
  }
}
