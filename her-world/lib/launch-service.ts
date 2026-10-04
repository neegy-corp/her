import { ComputeBudgetProgram, PublicKey, Transaction, type Connection } from "@solana/web3.js";
import bs58 from "bs58";
import { newLaunchWallet, launchKeypair } from "./launch-wallet";
import { ACP_LAUNCH_MIN_LAMPORTS } from "./acp-config";
import { buildFeeSharingSetup, verifyFeeSharing } from "./acp-coin";
import { launchWalletRow, insertLaunchWallet, claimFeeSetup, confirmFeeSetup, resetFeeSetup } from "./fee-funding-store";
import { transactionStatus } from "./transaction-status";
export async function ensureLaunchWallet(id: string, owner: string) {
  const existing = await launchWalletRow(id, owner);
  if (existing) return existing;
  const created = newLaunchWallet(id, owner);
  await insertLaunchWallet(id, owner, created.publicKey, created.sealed);
  const row = await launchWalletRow(id, owner);
  if (!row) throw new Error("Launch wallet could not be created.");
  return row;
}
export async function launchWalletView(rpc: Connection, id: string, owner: string) {
  const row = await ensureLaunchWallet(id, owner);
  return {
    address: row.public_key,
    balanceLamports: await rpc.getBalance(new PublicKey(row.public_key), "confirmed"),
    minLamports: ACP_LAUNCH_MIN_LAMPORTS,
    feeSetup: row.fee_setup_status,
    exported: !!row.exported_at,
  };
}
/**
 * After the coin confirms, the launch wallet (the coin's creator) splits its creator fees once:
 * ACP fee wallet / launch wallet (the developer's half). Pump locks the split permanently. Resumable and never sent twice.
 */
export async function ensureFeeSetup(rpc: Connection, id: string, owner: string, mint: string) {
  const row = await launchWalletRow(id, owner);
  if (!row || row.fee_setup_status === "confirmed") return row?.fee_setup_status || "none";
  if (row.fee_setup_status === "submitted" && row.fee_setup_signature) {
    const status = await transactionStatus(rpc, row.fee_setup_signature, row.fee_setup_last_valid_height);
    if (status === "failed" || status === "expired") {
      await resetFeeSetup(id, owner, row.fee_setup_signature);
      return "none";
    }
    if (status === "confirmed") {
      if (!(await verifyFeeSharing(rpc, mint, row.public_key)))
        throw new Error("The on-chain fee split does not match the reviewed 50/50 split between ACP and the launch wallet.");
      await confirmFeeSetup(id, owner);
      return "confirmed";
    }
    return "submitted";
  }
  const key = launchKeypair(row.sealed_secret, id, owner);
  const instructions = await buildFeeSharingSetup({ mint: new PublicKey(mint), launchWallet: key.publicKey });
  const latest = await rpc.getLatestBlockhash("confirmed");
  const tx = new Transaction({ feePayer: key.publicKey, recentBlockhash: latest.blockhash })
    .add(ComputeBudgetProgram.setComputeUnitLimit({ units: 400000 }), ...instructions);
  tx.sign(key);
  const signature = bs58.encode(tx.signature!);
  if (!(await claimFeeSetup(id, owner, signature, latest.lastValidBlockHeight))) return "submitted";
  try { await rpc.sendRawTransaction(tx.serialize(), { skipPreflight: false, maxRetries: 2 }); } catch { /* Reconciled from the persisted signature. */ }
  return "submitted";
}
export async function afterLaunch(rpc: Connection, id: string, owner: string, mint: string) {
  return ensureFeeSetup(rpc, id, owner, mint);
}
