import { ComputeBudgetProgram, PublicKey, SystemProgram, Transaction, type Connection, type Keypair } from "@solana/web3.js";
import bs58 from "bs58";
import { withDatabase } from "@/lib/database";
import { connection, json, mutationGuard, setting, wallet } from "@/lib/server";
import { ownedDraft, takeQuota } from "@/lib/launchpad-store";
import { fundedCreator } from "@/lib/launchpad-media";
import { buildFeeDistribution } from "@/lib/acp-coin";
import { launchKeypair } from "@/lib/launch-wallet";
import { ensureFeeSetup } from "@/lib/launch-service";
import { fulfillmentMicroUsd, providerBudgetMicroUsd } from "@/lib/generation-billing";
import { ACP_FEE_WALLET, ACP_FREE_VIDEO_SECONDS, ACP_PURCHASE_RESERVE_LAMPORTS } from "@/lib/acp-config";
import { solUsd, videoUsdPerSecond, lamportsFor, timeQuotes } from "@/lib/sol-price";
import { streamPlan } from "@/lib/stream-plans";
import { transactionStatus, validatePurchaseInput } from "@/lib/transaction-status";
import { streamCreditsEnabled, creditAccount, startCreditSession, stopCreditSession } from "@/lib/stream-credit-store";
import {
  launchWalletRow, freeGrant, pendingTimePurchases, claimTimePurchase, generationCapacity,
  creditTimePurchase, expireTimePurchase, type TimePurchase,
  timePurchaseRequest, claimFeeCollection, clearFeeCollection,
} from "@/lib/fee-funding-store";
export const runtime = "nodejs";
export const maxDuration = 60;
const uuid = (value: unknown): value is string => typeof value === "string" && /^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/i.test(value);
const sol = (lamports: number) => (lamports / 1e9).toLocaleString("en-US", { maximumFractionDigits: 4 });
// Credits a payment once it is confirmed on chain. Safe to repeat: a receipt credits once.
async function settle(rpc: Connection, id: string, who: string, purchase: TimePurchase) {
  const status = await transactionStatus(rpc, purchase.signature, purchase.last_valid_block_height);
  if (status === "confirmed") { await creditTimePurchase(id, who, purchase.signature); return "credited" as const; }
  if (status === "failed" || status === "expired") await expireTimePurchase(id, who, purchase.signature);
  return status;
}
// Pays the coin's accrued creator fees out to both shareholders. Permissionless; the launch wallet pays the network fee.
async function collectFees(rpc: Connection, mint: string, key: Keypair, id: string, owner: string) {
  const row = await launchWalletRow(id, owner);
  if (!row) throw new Error("Launch wallet unavailable.");
  if (row.collection_signature) {
    const status = await transactionStatus(rpc, row.collection_signature, row.collection_last_valid_height);
    if (status === "pending") return "pending";
    await clearFeeCollection(id, owner, row.collection_signature);
    return status === "confirmed" ? "collected" : "failed";
  }
  const instructions = await buildFeeDistribution(rpc, mint, key.publicKey);
  const latest = await rpc.getLatestBlockhash("confirmed");
  const tx = new Transaction({ feePayer: key.publicKey, recentBlockhash: latest.blockhash })
    .add(ComputeBudgetProgram.setComputeUnitLimit({ units: 300000 }), ...instructions);
  tx.sign(key);
  // Nothing to distribute, or below Pump's minimum: the simulation fails and nothing is sent.
  if ((await rpc.simulateTransaction(tx)).value.err) return "unavailable";
  const signature = bs58.encode(tx.signature!);
  if (!(await claimFeeCollection(id, owner, signature, latest.lastValidBlockHeight))) return "pending";
  try { await rpc.sendRawTransaction(tx.serialize(), { skipPreflight: false, maxRetries: 2 }); } catch { return "pending"; }
  await rpc.confirmTransaction({ signature, blockhash: latest.blockhash, lastValidBlockHeight: latest.lastValidBlockHeight }, "confirmed").catch(() => undefined);
  const status = await transactionStatus(rpc, signature, latest.lastValidBlockHeight);
  if (status === "pending") return "pending";
  await clearFeeCollection(id, owner, signature);
  return status === "confirmed" ? "collected" : "failed";
}
async function handle(req: Request) {
  try { return await withDatabase(setting("DATABASE_URL"), async () => {
    if (req.method === "POST") mutationGuard(req);
    const who = await wallet(req);
    if (!who) return json({ error: "Connect and verify the character's developer wallet." }, 401);
    const url = new URL(req.url), id = url.searchParams.get("id") || "";
    const row = await ownedDraft(id, who);
    if (!row) return json({ error: "Character not found in this wallet." }, 404);
    const enabled = streamCreditsEnabled();
    if (req.method === "GET") {
      // Polling reconciles existing signatures only; it never signs or sends a payment.
      for (const p of (await pendingTimePurchases(id, who)).results) await settle(connection(), id, who, p);
      const [account, grant, launch, pending, quotes] = await Promise.all([
        creditAccount(id, who), freeGrant(id, who), launchWalletRow(id, who), pendingTimePurchases(id, who),
        enabled ? timeQuotes().catch(() => null) : null,
      ]);
      const walletLamports = launch ? await connection().getBalance(new PublicKey(launch.public_key), "confirmed").catch(() => null) : null;
      const remaining = providerBudgetMicroUsd() - ((await generationCapacity())?.reserved_micro_usd || 0);
      return json({ enabled, streamSeconds: account?.stream_seconds || 0, videoSeconds: account?.video_seconds || 0,
        portraitCredits: account?.portrait_credits || 0, scriptCredits: account?.script_credits || 0,
        endsAt: account?.ends_at || 0, sessionId: account?.session_id || null, serverNow: Date.now(),
        freeSeconds: ACP_FREE_VIDEO_SECONDS, freeGranted: !!grant, feeSetup: launch?.fee_setup_status || "none",
        walletLamports, quotes: quotes?.filter(q => fulfillmentMicroUsd(q.minutes) <= remaining) ?? null, pending: pending.results.map(p => ({ signature: p.signature })) });
    }
    const raw = await req.text(); if (raw.length > 4000) throw new Error("Request too large.");
    const body = raw ? JSON.parse(raw) : {}, action = url.searchParams.get("action");
    // Stopping stays available if the program is paused later.
    if (action === "stop") {
      if (!uuid(body.sessionId)) throw new Error("Invalid session.");
      await stopCreditSession(id, who, body.sessionId); return json({ stopped: true });
    }
    if (!enabled) return json({ error: "Video time is not active yet." }, 503);
    // Credits never substitute for a funded provider account.
    fundedCreator(who);
    if (action === "start") {
      if (!uuid(body.sessionId)) throw new Error("Invalid session.");
      const account = await startCreditSession(id, who, body.sessionId);
      return json({ endsAt: account.ends_at, serverNow: Date.now() });
    }
    if (action === "grant") {
      return json({ error: "Generation requires payment. Free grants are disabled." }, 410);
    }
    if (action === "setup") {
      // Idempotent: sends the one-time 50/50 split once, then only reconciles its receipt.
      if (!row.mint) return json({ feeSetup: "none" });
      return json({ feeSetup: await ensureFeeSetup(connection(), id, who, row.mint) });
    }
    const launch = await launchWalletRow(id, who);
    if (!launch) throw new Error("Create this character's launch wallet first.");
    const rpc = connection(), key = launchKeypair(launch.sealed_secret, id, who);
    if (action === "collect") {
      if (!row.mint) throw new Error("Launch this character's coin before collecting trading fees.");
      if (launch.fee_setup_status !== "confirmed") throw new Error("Fee payouts turn on after the coin's fee split is confirmed.");
      await takeQuota(`collect:${who}`, 200);
      const status = await collectFees(rpc, row.mint, key, id, who);
      const walletLamports = await rpc.getBalance(key.publicKey, "confirmed");
      return json({ status, walletLamports,
        message: status === "collected" ? `Trading fees paid out. Your launch wallet holds ${sol(walletLamports)} SOL.` : status === "pending" ? "Fee collection is still confirming. No second collection was submitted." : "Fee collection could not complete. Check the wallet balance and accrued fees before trying again." });
    }
    if (action === "buy") {
      const plan = streamPlan(body.minutes);
      const { requestId, maxLamports } = validatePurchaseInput(body);
      await takeQuota(`buy:${who}`, 100);
      const previous = await timePurchaseRequest(id, who, requestId);
      if (previous) {
        if (previous.minutes !== plan.minutes) throw new Error("This request ID belongs to a different purchase.");
        const status = previous.status === "submitted" ? await settle(rpc, id, who, previous) : previous.status;
        return json({ status, minutes: previous.minutes, lamports: previous.lamports });
      }
      // Settle anything a previous attempt sent before sending again.
      for (const p of (await pendingTimePurchases(id, who)).results)
        if ((await settle(rpc, id, who, p)) === "pending") return json({ status: "pending", message: "A payment is still confirming. Check again in a moment." });
      const lamports = lamportsFor(plan.seconds, videoUsdPerSecond(), await solUsd());
      if (!Number.isSafeInteger(lamports) || lamports <= 0 || lamports > maxLamports)
        throw new Error("The SOL price moved. Review the new price and try again.");
      const reserve = fulfillmentMicroUsd(plan.minutes), ceiling = providerBudgetMicroUsd();
      if (reserve + ((await generationCapacity())?.reserved_micro_usd || 0) > ceiling)
        throw new Error("Generation capacity is temporarily sold out. No payment was sent.");
      let balance = await rpc.getBalance(key.publicKey, "confirmed");
      if (balance < lamports + ACP_PURCHASE_RESERVE_LAMPORTS && row.mint && launch.fee_setup_status === "confirmed") {
        const collection = await collectFees(rpc, row.mint, key, id, who);
        if (collection === "pending") return json({ status: "pending", message: "Trading fees are still confirming. No time payment was submitted." });
        balance = await rpc.getBalance(key.publicKey, "confirmed");
      }
      if (balance < lamports + ACP_PURCHASE_RESERVE_LAMPORTS)
        throw new Error(`${plan.minutes} minutes costs ${sol(lamports)} SOL and your launch wallet holds ${sol(balance)} SOL. It receives half of your coin's trading fees, and you can also deposit SOL to its address.`);
      const latest = await rpc.getLatestBlockhash("confirmed");
      const tx = new Transaction({ feePayer: key.publicKey, recentBlockhash: latest.blockhash })
        .add(SystemProgram.transfer({ fromPubkey: key.publicKey, toPubkey: new PublicKey(ACP_FEE_WALLET), lamports }));
      tx.sign(key);
      const signature = bs58.encode(tx.signature!);
      if (!(await claimTimePurchase(id, who, signature, plan.minutes, lamports, requestId, latest.lastValidBlockHeight, reserve, ceiling))) return json({ status: "pending", message: "A payment is already in progress or generation capacity has sold out. No additional payment was sent." });
      try { await rpc.sendRawTransaction(tx.serialize(), { skipPreflight: false, maxRetries: 2 }); } catch { /* The persisted signature is reconciled on the next check; never sent twice. */ }
      await rpc.confirmTransaction({ signature, blockhash: latest.blockhash, lastValidBlockHeight: latest.lastValidBlockHeight }, "confirmed").catch(() => undefined);
      const [purchase] = (await pendingTimePurchases(id, who)).results.filter(p => p.signature === signature);
      const status = purchase ? await settle(rpc, id, who, purchase) : "credited";
      const account = await creditAccount(id, who);
      return json({ status, minutes: plan.minutes, lamports, streamSeconds: account?.stream_seconds || 0, videoSeconds: account?.video_seconds || 0,
        walletLamports: await rpc.getBalance(key.publicKey, "confirmed") });
    }
    return json({ error: "Unknown credit action." }, 404);
  }); } catch (error) { return json({ error: error instanceof Error ? error.message : "Video time unavailable." }, 400); }
}
export const GET = handle;
export const POST = handle;
