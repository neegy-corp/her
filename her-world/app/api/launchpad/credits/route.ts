import { PublicKey, Transaction, TransactionInstruction } from "@solana/web3.js";
import { createBurnCheckedInstruction, getAssociatedTokenAddressSync, TOKEN_PROGRAM_ID, TOKEN_2022_PROGRAM_ID } from "@solana/spl-token";
import bs58 from "bs58";
import { withDatabase } from "@/lib/database";
import { connection, json, mutationGuard, rawAmount, setting, wallet } from "@/lib/server";
import { ownedDraft, takeQuota } from "@/lib/launchpad-store";
import { fundedCreator } from "@/lib/launchpad-media";
import { validateBurn } from "@/lib/burn-validation";
import { streamPlan, streamPlans } from "@/lib/stream-plans";
import { streamCreditsEnabled, creditAccount, creditBurn, pendingCreditBurns, saveCreditBurn, claimCreditBurn, applyCreditBurn, startCreditSession, stopCreditSession } from "@/lib/stream-credit-store";
export const runtime = "nodejs";
export const maxDuration = 60;
const memo = (id: string) => `ACP:stream:${id}`;
const uuid = (value: unknown): value is string => typeof value === "string" && /^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/i.test(value);
async function handle(req: Request) {
  try { return await withDatabase(setting("DATABASE_URL"), async () => {
    if (req.method === "POST") mutationGuard(req);
    const who = await wallet(req);
    if (!who) return json({error:"Connect and verify the character's developer wallet."},401);
    const url = new URL(req.url), id = url.searchParams.get("id") || "";
    const row = await ownedDraft(id,who);
    if (!row) return json({error:"Character not found in this wallet."},404);
    const mintValue = setting("ACP_CREDIT_MINT");
    const enabled = streamCreditsEnabled() && !!mintValue;
    if (req.method === "GET") {
      const account = mintValue ? await creditAccount(id,who) : null;
      return json({enabled,mint:mintValue || null,symbol:"ACP",plans:streamPlans,
        streamSeconds:account?.stream_seconds || 0,videoSeconds:account?.video_seconds || 0,
        endsAt:account?.ends_at || 0,sessionId:account?.session_id || null,serverNow:Date.now(),
        pending:mintValue ? await pendingCreditBurns(id,who) : []});
    }
    const raw = await req.text(); if (raw.length > 12000) throw new Error("Request too large.");
    const body = JSON.parse(raw), action = url.searchParams.get("action");
    // Reconciliation and stopping remain available if sales are paused later.
    if (action === "verify") {
      const intent = await creditBurn(body.intentId,who);
      if (!intent || intent.character_id !== id || !intent.signature) throw new Error("Submitted burn not found.");
      if (intent.status !== "credited") {
        const tx = await connection().getParsedTransaction(intent.signature,{commitment:"finalized",maxSupportedTransactionVersion:0});
        validateBurn(tx ? {...tx,transaction:{message:{accountKeys:tx.transaction.message.accountKeys.map(a=>({pubkey:a.pubkey.toBase58(),signer:a.signer})),instructions:tx.transaction.message.instructions.map(i=>({...i,programId:i.programId.toBase58()}))}}} : null,{...intent,memo:memo(intent.id)});
        await applyCreditBurn(intent.id,who,intent.signature);
      }
      return json({verified:true});
    }
    if (action === "stop") {
      if (!uuid(body.sessionId)) throw new Error("Invalid session.");
      await stopCreditSession(id,who,body.sessionId); return json({stopped:true});
    }
    if (!enabled) return json({error:"ACP time purchases are not active. No burn was submitted."},503);
    // Burning is never a substitute for a funded provider account.
    fundedCreator(who);
    if (action === "start") {
      if (!uuid(body.sessionId)) throw new Error("Invalid session.");
      const account = await startCreditSession(id,who,body.sessionId);
      return json({endsAt:account.ends_at,serverNow:Date.now()});
    }
    if (action === "prepare") {
      const plan = streamPlan(body.minutes);
      if ((await pendingCreditBurns(id,who)).length) throw new Error("Verify the submitted burn before creating another one.");
      if (setting("HER_LAUNCHPAD_VIDEOS_ENABLED") !== "true" || !(setting("HF_API_KEY") || setting("FAL_KEY"))) throw new Error("Video generation is unavailable. No burn was prepared.");
      await takeQuota(`stream-burn:${who}`,20);
      const rpc=connection(),mint=new PublicKey(mintValue),owner=new PublicKey(who);
      const mintInfo=await rpc.getParsedAccountInfo(mint), data=mintInfo.value?.data;
      if (!mintInfo.value || !data || !("parsed" in data) || data.parsed.type !== "mint") throw new Error("ACP mint unavailable.");
      const program=mintInfo.value.owner;
      if (![TOKEN_PROGRAM_ID.toBase58(),TOKEN_2022_PROGRAM_ID.toBase58()].includes(program.toBase58())) throw new Error("Unsupported token program.");
      const decimals=Number(data.parsed.info.decimals);
      if (!Number.isInteger(decimals) || decimals<0 || decimals>18) throw new Error("Invalid ACP precision.");
      const amount=rawAmount(String(plan.tokens),decimals),source=getAssociatedTokenAddressSync(mint,owner,false,program);
      const sourceInfo=await rpc.getParsedAccountInfo(source), sourceData=sourceInfo.value?.data;
      const info=sourceData && "parsed" in sourceData ? sourceData.parsed.info : null;
      if (!info || info.owner!==who || info.mint!==mintValue || info.state!=="initialized" || BigInt(info.tokenAmount.amount)<amount) throw new Error(`Your developer wallet needs ${plan.tokens.toLocaleString()} ACP in its standard token account, plus SOL for the network fee.`);
      const intentId=crypto.randomUUID(),now=Date.now(),latest=await rpc.getLatestBlockhash();
      const tx=new Transaction({feePayer:owner,recentBlockhash:latest.blockhash}).add(createBurnCheckedInstruction(source,mint,owner,amount,decimals,[],program),new TransactionInstruction({keys:[],programId:new PublicKey("MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr"),data:Buffer.from(memo(intentId))}));
      await saveCreditBurn({id:intentId,character_id:id,wallet:who,mint:mintValue,minutes:plan.minutes,raw_amount:amount.toString(),program:program.toBase58(),message:tx.serializeMessage().toString("hex"),created_at:now,expires:now+90000,signature:null,status:"prepared"});
      return json({intentId,minutes:plan.minutes,tokens:plan.tokens,mint:mintValue,expires:now+90000,unsignedTransaction:tx.serialize({requireAllSignatures:false,verifySignatures:false}).toString("hex")});
    }
    if (action === "submit") {
      const intent=await creditBurn(body.intentId,who);
      if (!intent || intent.character_id!==id) throw new Error("Burn request not found.");
      if (intent.signature) return json({signature:intent.signature,pending:true});
      if (intent.expires<Date.now() || intent.mint!==mintValue) throw new Error("Burn review expired. Review a fresh request.");
      if (typeof body.signedTransaction!=="string" || !/^[a-f0-9]+$/i.test(body.signedTransaction) || body.signedTransaction.length>6000) throw new Error("Invalid transaction.");
      const tx=Transaction.from(Buffer.from(body.signedTransaction,"hex"));
      if (tx.feePayer?.toBase58()!==who || !tx.verifySignatures() || tx.serializeMessage().toString("hex")!==intent.message) throw new Error("Signed transaction does not match the reviewed burn.");
      const signature=bs58.encode(tx.signature!);
      if (!await claimCreditBurn(intent.id,who,signature)) throw new Error("This burn was already submitted. Verify its receipt.");
      try { await connection().sendRawTransaction(tx.serialize(),{skipPreflight:false,maxRetries:2}); } catch { /* Persisted signature is reconciled; never submit a different burn automatically. */ }
      return json({signature,pending:true});
    }
    return json({error:"Unknown credit action."},404);
  }); } catch(error) { return json({error:error instanceof Error ? error.message : "Stream credits unavailable."},400); }
}
export const GET=handle;
export const POST=handle;
