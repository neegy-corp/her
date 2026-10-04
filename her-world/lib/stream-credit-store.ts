import { db } from "./database";
import { setting } from "./server";
import type { RenderRow } from "./launchpad-store";
import { VIDEO_CREDIT_EXHAUSTED } from "./stream-plans";
// Fee-funded video: the free grant and creator-fee credits gate every render and the stream clock.
export const streamCreditsEnabled = () => setting("ACP_STREAM_CREDITS_ENABLED") === "true";
export const videoLamportsPerSecond = () => { const n = Number(setting("ACP_VIDEO_LAMPORTS_PER_SECOND")); return Number.isSafeInteger(n) && n > 0 ? n : 0; };
export type CreditAccount = { character_id: string; wallet: string; stream_seconds: number; video_seconds: number; ends_at: number; session_id: string | null; portrait_credits: number; script_credits: number };
export const creditAccount = (id: string, owner: string) => db().prepare("SELECT * FROM her_private.stream_credit_accounts WHERE character_id=? AND wallet=?").bind(id, owner).first<CreditAccount>();
export async function startCreditSession(id: string, owner: string, session: string, now = Date.now()) {
  const account = await db().prepare("UPDATE her_private.stream_credit_accounts SET ends_at=GREATEST(ends_at,?)+stream_seconds*1000,stream_seconds=0,session_id=? WHERE character_id=? AND wallet=? AND (session_id IS NULL OR session_id=? OR ends_at<=?) AND (stream_seconds>0 OR ends_at>?) RETURNING *").bind(now,session,id,owner,session,now,now).first<CreditAccount>();
  if (!account) throw new Error("No stream time left, or another session is already using this character. Check for new trading fees or stop the other session.");
  return account;
}
export async function stopCreditSession(id: string, owner: string, session: string, now = Date.now()) {
  return db().prepare("UPDATE her_private.stream_credit_accounts SET stream_seconds=stream_seconds+GREATEST(0,(ends_at-?)/1000),ends_at=0,session_id=NULL WHERE character_id=? AND wallet=? AND session_id=? RETURNING *").bind(now,id,owner,session).first<CreditAccount>();
}
export async function requireVideoCredit(id: string, owner: string) {
  const a = await creditAccount(id, owner);
  if (!a || a.video_seconds <= 0 || (a.stream_seconds <= 0 && a.ends_at <= Date.now())) throw new Error(VIDEO_CREDIT_EXHAUSTED);
}
export const debitScript = (id: string, owner: string) =>
  db().prepare("UPDATE her_private.stream_credit_accounts SET script_credits=script_credits-1 WHERE character_id=? AND wallet=? AND script_credits>0 RETURNING character_id").bind(id, owner).first();
export const claimPortrait = (r: RenderRow) =>
  db().prepare("WITH account AS (SELECT * FROM her_private.stream_credit_accounts WHERE character_id=? AND wallet=? FOR UPDATE), added AS (INSERT INTO her_private.launchpad_renders (id,character_id,wallet,clip_id,fingerprint,provider,status,created_at) SELECT ?,?,?,?,?,?,'submitting',? FROM account WHERE portrait_credits>0 ON CONFLICT (character_id,clip_id,fingerprint) DO NOTHING RETURNING id), spent AS (UPDATE her_private.stream_credit_accounts SET portrait_credits=portrait_credits-1 WHERE character_id=? AND wallet=? AND EXISTS(SELECT 1 FROM added) RETURNING character_id) SELECT id FROM added WHERE EXISTS(SELECT 1 FROM spent)").bind(r.character_id,r.wallet,r.id,r.character_id,r.wallet,r.clip_id,r.fingerprint,r.provider,r.created_at,r.character_id,r.wallet).first();
// The balance lock, durable render claim and debit are one database transaction.
// Unknown provider submissions retain their debit and cannot be retried for free.
export async function claimCreditRender(r: RenderRow, seconds: number, now = Date.now()) {
  if (!Number.isInteger(seconds) || seconds < 3 || seconds > 15) throw new Error("Invalid video duration.");
  return db().prepare("WITH account AS (SELECT * FROM her_private.stream_credit_accounts WHERE character_id=? AND wallet=? FOR UPDATE), added AS (INSERT INTO her_private.launchpad_renders (id,character_id,wallet,clip_id,fingerprint,provider,status,created_at) SELECT ?,?,?,?, ?,?,'submitting',? FROM account WHERE video_seconds>=? AND (stream_seconds>0 OR ends_at>?) ON CONFLICT (character_id,clip_id,fingerprint) DO NOTHING RETURNING id), spent AS (UPDATE her_private.stream_credit_accounts SET video_seconds=video_seconds-? WHERE character_id=? AND wallet=? AND EXISTS(SELECT 1 FROM added) RETURNING character_id) SELECT id FROM added WHERE EXISTS(SELECT 1 FROM spent)").bind(r.character_id,r.wallet,r.id,r.character_id,r.wallet,r.clip_id,r.fingerprint,r.provider,r.created_at,seconds,now,seconds,r.character_id,r.wallet).first();
}
