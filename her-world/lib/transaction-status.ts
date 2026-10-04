import type { Connection } from "@solana/web3.js";

/** A clock timeout never proves a Solana transaction expired. Unknown receipts stay pending. */
export async function transactionStatus(rpc: Connection, signature: string, lastValidBlockHeight: number | null) {
  const read = async () => (await rpc.getSignatureStatuses([signature], { searchTransactionHistory: true })).value[0];
  const classify = (receipt: Awaited<ReturnType<typeof read>>) => {
    if (!receipt || !["confirmed", "finalized"].includes(receipt.confirmationStatus || "")) return "pending" as const;
    return receipt.err ? "failed" as const : "confirmed" as const;
  };
  const first = await read();
  if (classify(first) !== "pending") return classify(first);
  if (first || !Number.isSafeInteger(lastValidBlockHeight) || Number(lastValidBlockHeight) <= 0) return "pending" as const;
  if (await rpc.getBlockHeight("finalized") <= Number(lastValidBlockHeight)) return "pending" as const;
  // Re-check history after the finalized chain has passed the validity window.
  const second = await read();
  if (second) return classify(second);
  const transaction = await rpc.getTransaction(signature, { commitment: "finalized", maxSupportedTransactionVersion: 0 });
  if (transaction?.meta) return transaction.meta.err ? "failed" as const : "confirmed" as const;
  if (transaction) return "pending" as const;
  return "expired" as const;
}

export function validatePurchaseInput(body: { requestId?: unknown; maxLamports?: unknown }) {
  if (typeof body.requestId !== "string" || !/^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/i.test(body.requestId))
    throw new Error("A purchase request ID is required. Refresh the price and try again.");
  if (typeof body.maxLamports !== "number" || !Number.isSafeInteger(body.maxLamports) || body.maxLamports <= 0)
    throw new Error("Review a valid maximum SOL price before buying time.");
  return { requestId: body.requestId, maxLamports: body.maxLamports };
}
