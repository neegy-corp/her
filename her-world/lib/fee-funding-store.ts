import { db } from "./database";
export type LaunchWalletRow = {
  character_id: string; wallet: string; public_key: string; sealed_secret: string;
  created_at: number; exported_at: number | null;
  fee_setup_status: "none" | "submitted" | "confirmed"; fee_setup_signature: string | null; fee_setup_at: number | null;
  fee_setup_last_valid_height: number | null; collection_signature: string | null; collection_last_valid_height: number | null;
};
export const launchWalletRow = (id: string, owner: string) =>
  db().prepare("SELECT * FROM her_private.launch_wallets WHERE character_id=? AND wallet=?").bind(id, owner).first<LaunchWalletRow>();
export const insertLaunchWallet = (id: string, owner: string, publicKey: string, sealed: string) =>
  db().prepare("INSERT INTO her_private.launch_wallets (character_id,wallet,public_key,sealed_secret,created_at) VALUES (?,?,?,?,?) ON CONFLICT (character_id) DO NOTHING RETURNING character_id")
    .bind(id, owner, publicKey, sealed, Date.now()).first();
export const markWalletExported = (id: string, owner: string) =>
  db().prepare("UPDATE her_private.launch_wallets SET exported_at=? WHERE character_id=? AND wallet=? RETURNING character_id").bind(Date.now(), id, owner).first();
// The setup signature is persisted before the network call, so an ambiguous send is reconciled, never repeated.
export const claimFeeSetup = (id: string, owner: string, signature: string, height: number) =>
  db().prepare("UPDATE her_private.launch_wallets SET fee_setup_status='submitted',fee_setup_signature=?,fee_setup_at=?,fee_setup_last_valid_height=? WHERE character_id=? AND wallet=? AND fee_setup_status='none' RETURNING character_id").bind(signature, Date.now(), height, id, owner).first();
export const confirmFeeSetup = (id: string, owner: string) =>
  db().prepare("UPDATE her_private.launch_wallets SET fee_setup_status='confirmed' WHERE character_id=? AND wallet=? AND fee_setup_status='submitted' RETURNING character_id").bind(id, owner).first();
// ACP pays for the first block of video and stream time. One grant per character, ever.
export const grantFreeVideo = (id: string, owner: string, seconds: number, now = Date.now()) =>
  db().prepare("WITH granted AS (INSERT INTO her_private.free_video_grants (character_id,wallet,seconds,created_at) VALUES (?,?,?,?) ON CONFLICT (character_id) DO NOTHING RETURNING character_id,wallet,seconds) INSERT INTO her_private.stream_credit_accounts (character_id,wallet,stream_seconds,video_seconds,ends_at) SELECT character_id,wallet,seconds,seconds,0 FROM granted ON CONFLICT (character_id) DO UPDATE SET stream_seconds=her_private.stream_credit_accounts.stream_seconds+CASE WHEN her_private.stream_credit_accounts.ends_at>? THEN 0 ELSE EXCLUDED.stream_seconds END,video_seconds=her_private.stream_credit_accounts.video_seconds+EXCLUDED.video_seconds,ends_at=CASE WHEN her_private.stream_credit_accounts.ends_at>? THEN her_private.stream_credit_accounts.ends_at+EXCLUDED.stream_seconds*1000 ELSE her_private.stream_credit_accounts.ends_at END RETURNING character_id")
    .bind(id, owner, seconds, now, now, now).first();
export const freeGrant = (id: string, owner: string) =>
  db().prepare("SELECT seconds FROM her_private.free_video_grants WHERE character_id=? AND wallet=?").bind(id, owner).first<{ seconds: number }>();
const CREDIT_UPSERT = "INSERT INTO her_private.stream_credit_accounts (character_id,wallet,stream_seconds,video_seconds,portrait_credits,script_credits,ends_at) SELECT character_id,wallet,minutes*60,minutes*60,minutes,minutes*20,0 FROM marked ON CONFLICT (character_id) DO UPDATE SET portrait_credits=her_private.stream_credit_accounts.portrait_credits+EXCLUDED.portrait_credits,script_credits=her_private.stream_credit_accounts.script_credits+EXCLUDED.script_credits,stream_seconds=her_private.stream_credit_accounts.stream_seconds+CASE WHEN her_private.stream_credit_accounts.ends_at>? THEN 0 ELSE EXCLUDED.stream_seconds END,video_seconds=her_private.stream_credit_accounts.video_seconds+EXCLUDED.video_seconds,ends_at=CASE WHEN her_private.stream_credit_accounts.ends_at>? THEN her_private.stream_credit_accounts.ends_at+EXCLUDED.stream_seconds*1000 ELSE her_private.stream_credit_accounts.ends_at END RETURNING character_id";
export const generationCapacity = () => db().prepare("SELECT reserved_micro_usd FROM her_private.generation_capacity WHERE id='acp'").first<{ reserved_micro_usd: number }>();
export type TimePurchase = { signature: string; character_id: string; request_id: string; last_valid_block_height: number; minutes: number; lamports: number; status: "submitted" | "credited" | "expired"; created_at: number };
export const timePurchaseRequest = (id: string, owner: string, requestId: string) =>
  db().prepare("SELECT * FROM her_private.time_purchases WHERE character_id=? AND wallet=? AND request_id=?").bind(id, owner, requestId).first<TimePurchase>();
export const pendingTimePurchases = (id: string, owner: string) =>
  db().prepare("SELECT * FROM her_private.time_purchases WHERE character_id=? AND wallet=? AND status='submitted' ORDER BY created_at DESC LIMIT 5").bind(id, owner).all<TimePurchase>();
// The signature is persisted before the network call, so an ambiguous send is reconciled and never paid twice.
export const claimTimePurchase = (id: string, owner: string, signature: string, minutes: number, lamports: number, requestId: string, height: number, reserve: number, ceiling: number) =>
  db().prepare("WITH capacity AS (SELECT * FROM her_private.generation_capacity WHERE id='acp' FOR UPDATE), added AS (INSERT INTO her_private.time_purchases (signature,character_id,wallet,minutes,lamports,request_id,last_valid_block_height,reserve_micro_usd,status,created_at) SELECT ?,?,?,?,?,?,?,?,'submitted',? FROM capacity WHERE reserved_micro_usd+?<=? ON CONFLICT DO NOTHING RETURNING signature,reserve_micro_usd), reserved AS (UPDATE her_private.generation_capacity SET reserved_micro_usd=reserved_micro_usd+(SELECT reserve_micro_usd FROM added) WHERE id='acp' AND EXISTS(SELECT 1 FROM added) RETURNING id) SELECT signature FROM added WHERE EXISTS(SELECT 1 FROM reserved)").bind(signature, id, owner, minutes, lamports, requestId, height, reserve, Date.now(), reserve, ceiling).first();
// One statement: the receipt flips to credited and the time is added together, so a payment can never credit twice.
export const creditTimePurchase = (id: string, owner: string, signature: string, now = Date.now()) =>
  db().prepare("WITH marked AS (UPDATE her_private.time_purchases SET status='credited' WHERE signature=? AND character_id=? AND wallet=? AND status='submitted' RETURNING character_id,wallet,minutes) " + CREDIT_UPSERT).bind(signature, id, owner, now, now).first();
// A payment that failed or whose blockhash expired cannot land any more.
export const expireTimePurchase = (id: string, owner: string, signature: string) =>
  db().prepare("WITH expired AS (UPDATE her_private.time_purchases SET status='expired' WHERE signature=? AND character_id=? AND wallet=? AND status='submitted' RETURNING signature,reserve_micro_usd), released AS (UPDATE her_private.generation_capacity SET reserved_micro_usd=reserved_micro_usd-(SELECT reserve_micro_usd FROM expired) WHERE id='acp' AND EXISTS(SELECT 1 FROM expired) RETURNING id) SELECT signature FROM expired WHERE EXISTS(SELECT 1 FROM released)").bind(signature, id, owner).first();
// Only for a setup transaction that failed or whose blockhash has expired, so it cannot still land.
export const resetFeeSetup = (id: string, owner: string, signature: string) =>
  db().prepare("UPDATE her_private.launch_wallets SET fee_setup_status='none',fee_setup_signature=NULL,fee_setup_at=NULL,fee_setup_last_valid_height=NULL WHERE character_id=? AND wallet=? AND fee_setup_status='submitted' AND fee_setup_signature=? RETURNING character_id").bind(id, owner, signature).first();
export const claimFeeCollection = (id: string, owner: string, signature: string, height: number) =>
  db().prepare("UPDATE her_private.launch_wallets SET collection_signature=?,collection_last_valid_height=? WHERE character_id=? AND wallet=? AND collection_signature IS NULL RETURNING character_id").bind(signature, height, id, owner).first();
export const clearFeeCollection = (id: string, owner: string, signature: string) =>
  db().prepare("UPDATE her_private.launch_wallets SET collection_signature=NULL,collection_last_valid_height=NULL WHERE character_id=? AND wallet=? AND collection_signature=? RETURNING character_id").bind(id, owner, signature).first();
