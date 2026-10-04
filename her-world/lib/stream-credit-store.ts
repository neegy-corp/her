import { db } from "./database";
import { setting } from "./server";
import type { RenderRow } from "./launchpad-store";
import { VIDEO_CREDIT_EXHAUSTED } from "./stream-plans";
export const streamCreditsEnabled = () => setting("ACP_STREAM_CREDITS_ENABLED") === "true" && !!setting("ACP_CREDIT_MINT");
export type CreditAccount = { character_id: string; wallet: string; stream_seconds: number; video_seconds: number; ends_at: number; session_id: string | null };
export type CreditBurn = { id: string; character_id: string; wallet: string; mint: string; minutes: number; raw_amount: string; program: string; message: string; created_at: number; expires: number; signature: string | null; status: string };
export const creditAccount = (id: string, owner: string) => db().prepare("SELECT * FROM her_private.stream_credit_accounts WHERE character_id=? AND wallet=?").bind(id, owner).first<CreditAccount>();
export const creditBurn = (id: string, owner: string) => db().prepare("SELECT * FROM her_private.stream_credit_burns WHERE id=? AND wallet=?").bind(id, owner).first<CreditBurn>();
export async function pendingCreditBurns(id: string, owner: string) {
  return (await db().prepare("SELECT id,minutes,signature,status FROM her_private.stream_credit_burns WHERE character_id=? AND wallet=? AND status='submitted' ORDER BY created_at DESC LIMIT 20").bind(id,owner).all<Pick<CreditBurn,"id"|"minutes"|"signature"|"status">>()).results;
}
export async function saveCreditBurn(b: CreditBurn) {
  await db().prepare("INSERT INTO her_private.stream_credit_burns (id,character_id,wallet,mint,minutes,raw_amount,program,message,created_at,expires,status) VALUES (?,?,?,?,?,?,?,?,?,?,'prepared')").bind(b.id,b.character_id,b.wallet,b.mint,b.minutes,b.raw_amount,b.program,b.message,b.created_at,b.expires).run();
}
export async function claimCreditBurn(id: string, owner: string, signature: string) {
  return db().prepare("UPDATE her_private.stream_credit_burns SET signature=?,status='submitted' WHERE id=? AND wallet=? AND status='prepared' AND expires>? RETURNING id").bind(signature,id,owner,Date.now()).first();
}
export async function applyCreditBurn(id: string, owner: string, signature: string, now = Date.now()) {
  return db().prepare("WITH credited AS (UPDATE her_private.stream_credit_burns SET status='credited' WHERE id=? AND wallet=? AND signature=? AND status='submitted' RETURNING character_id,wallet,minutes) INSERT INTO her_private.stream_credit_accounts (character_id,wallet,stream_seconds,video_seconds,ends_at) SELECT character_id,wallet,minutes*60,minutes*60,0 FROM credited ON CONFLICT (character_id) DO UPDATE SET stream_seconds=her_private.stream_credit_accounts.stream_seconds+CASE WHEN her_private.stream_credit_accounts.ends_at>? THEN 0 ELSE EXCLUDED.stream_seconds END,video_seconds=her_private.stream_credit_accounts.video_seconds+EXCLUDED.video_seconds,ends_at=CASE WHEN her_private.stream_credit_accounts.ends_at>? THEN her_private.stream_credit_accounts.ends_at+EXCLUDED.stream_seconds*1000 ELSE her_private.stream_credit_accounts.ends_at END RETURNING character_id").bind(id,owner,signature,now,now).first();
}
export async function startCreditSession(id: string, owner: string, session: string, now = Date.now()) {
  const account = await db().prepare("UPDATE her_private.stream_credit_accounts SET ends_at=GREATEST(ends_at,?)+stream_seconds*1000,stream_seconds=0,session_id=? WHERE character_id=? AND wallet=? AND (session_id IS NULL OR session_id=? OR ends_at<=?) AND (stream_seconds>0 OR ends_at>?) RETURNING *").bind(now,session,id,owner,session,now,now).first<CreditAccount>();
  if (!account) throw new Error("Buy stream time first, or stop the session already using this character.");
  return account;
}
export async function stopCreditSession(id: string, owner: string, session: string, now = Date.now()) {
  return db().prepare("UPDATE her_private.stream_credit_accounts SET stream_seconds=stream_seconds+GREATEST(0,(ends_at-?)/1000),ends_at=0,session_id=NULL WHERE character_id=? AND wallet=? AND session_id=? RETURNING *").bind(now,id,owner,session).first<CreditAccount>();
}
export async function requireVideoCredit(id: string, owner: string) {
  const a = await creditAccount(id, owner);
  if (!a || a.video_seconds <= 0 || (a.stream_seconds <= 0 && a.ends_at <= Date.now())) throw new Error(VIDEO_CREDIT_EXHAUSTED);
}
// The balance lock, durable render claim and debit are one database transaction.
// Unknown provider submissions retain their debit and cannot be retried for free.
export async function claimCreditRender(r: RenderRow, seconds: number, now = Date.now()) {
  if (!Number.isInteger(seconds) || seconds < 3 || seconds > 15) throw new Error("Invalid video duration.");
  return db().prepare("WITH account AS (SELECT * FROM her_private.stream_credit_accounts WHERE character_id=? AND wallet=? FOR UPDATE), added AS (INSERT INTO her_private.launchpad_renders (id,character_id,wallet,clip_id,fingerprint,provider,status,created_at) SELECT ?,?,?,?, ?,?,'submitting',? FROM account WHERE video_seconds>=? AND (stream_seconds>0 OR ends_at>?) ON CONFLICT (character_id,clip_id,fingerprint) DO NOTHING RETURNING id), spent AS (UPDATE her_private.stream_credit_accounts SET video_seconds=video_seconds-? WHERE character_id=? AND wallet=? AND EXISTS(SELECT 1 FROM added) RETURNING character_id) SELECT id FROM added WHERE EXISTS(SELECT 1 FROM spent)").bind(r.character_id,r.wallet,r.id,r.character_id,r.wallet,r.clip_id,r.fingerprint,r.provider,r.created_at,seconds,now,seconds,r.character_id,r.wallet).first();
}
