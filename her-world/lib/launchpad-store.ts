import { db } from "./database";
import type { PublicTokenRow } from "./public-tokens";

export async function publicTokenRows(offset: number) {
  return (
    await db()
      .prepare(
        "SELECT c.id,c.document::jsonb->>'name' AS name,c.document::jsonb->>'symbol' AS symbol,c.document::jsonb->>'description' AS description,c.mint,c.document::jsonb->>'coinPfp' AS pfp,c.document::jsonb->>'coinBanner' AS banner FROM her_private.launchpad_characters c JOIN her_private.launchpad_coins t ON t.id=c.id AND t.wallet=c.wallet AND t.mint=c.mint AND t.signature=c.signature WHERE t.status='confirmed' ORDER BY c.updated_at DESC,c.id LIMIT 25 OFFSET ?",
      )
      .bind(offset)
      .all<PublicTokenRow>()
  ).results;
}
import type { CharacterDraft } from "./launchpad";
import { referenceFingerprint } from "./launchpad";

export type DraftRow = {
  id: string;
  wallet: string;
  document: string;
  image_url: string | null;
  image_fingerprint: string | null;
  face_id: string | null;
  face_status: string;
  pal_id: string | null;
  mint: string | null;
  signature: string | null;
  updated_at: number;
};
export async function ownedDraft(id: string, owner: string) {
  return db()
    .prepare(
      "SELECT * FROM her_private.launchpad_characters WHERE id = ? AND wallet = ?",
    )
    .bind(id, owner)
    .first<DraftRow>();
}
export async function saveDraft(draft: CharacterDraft, owner: string) {
  const old = await ownedDraft(draft.id, owner);
  if (old?.mint) {
    const previous = JSON.parse(old.document) as CharacterDraft;
    if (
      (previous.coinPfp || "") !== draft.coinPfp ||
      (previous.coinBanner || "") !== draft.coinBanner
    )
      throw new Error("Deployed coin artwork is locked.");
  }
  const storedAssets = await assets(draft.id, owner);
  draft={...draft,referenceFingerprint:referenceFingerprint(storedAssets.filter(a=>a.purpose==="reference").map(a=>a.url))};
  for (const [field, purpose] of [
    ["coinPfp", "pfp"],
    ["coinBanner", "banner"],
  ] as const) {
    if (
      draft[field] &&
      !storedAssets.some((a) => a.purpose === purpose && a.url === draft[field])
    )
      throw new Error(
        "Upload coin artwork to this character before saving it.",
      );
  }
  if (old && (old.face_status !== "draft" || old.mint)) {
    const previous = JSON.parse(old.document) as CharacterDraft;
    if (
      [
        "name",
        "symbol",
        "appearance",
        "background",
        "voice",
        "rightsConfirmed",
      ].some(
        (k) =>
          previous[k as keyof CharacterDraft] !==
          draft[k as keyof CharacterDraft],
      )
    )
      throw new Error(
        "Face and coin identity are locked. Create a new character to change them; you can still edit the show.",
      );
  }
  const row = await db()
    .prepare(
      "INSERT INTO her_private.launchpad_characters (id,wallet,document,updated_at) VALUES (?,?,?,?) ON CONFLICT (id) DO UPDATE SET document=EXCLUDED.document,updated_at=EXCLUDED.updated_at WHERE her_private.launchpad_characters.wallet=EXCLUDED.wallet AND her_private.launchpad_characters.updated_at=? RETURNING id",
    )
    .bind(
      draft.id,
      owner,
      JSON.stringify({ ...draft, image: "", imageFingerprint: "" }),
      Date.now(),
      old?.updated_at || 0,
    )
    .first();
  if (!row)
    throw new Error(
      "This character is locked for training or launch. Duplicate it to make a new version.",
    );
}
export async function listDrafts(owner: string) {
  return (
    await db()
      .prepare(
        "SELECT * FROM her_private.launchpad_characters WHERE wallet = ? ORDER BY updated_at DESC LIMIT 30",
      )
      .bind(owner)
      .all<DraftRow>()
  ).results;
}
export async function takeQuota(owner: string, maximum: number) {
  const bucket = Math.floor(Date.now() / 86400000);
  const row = await db()
    .prepare(
      "INSERT INTO her_private.launchpad_usage (wallet,bucket,attempts) VALUES (?,?,1) ON CONFLICT (wallet,bucket) DO UPDATE SET attempts=her_private.launchpad_usage.attempts+1 WHERE her_private.launchpad_usage.attempts < ? RETURNING attempts",
    )
    .bind(owner, bucket, maximum)
    .first();
  if (!row)
    throw new Error(
      "Daily creation allowance reached. Your saved character is safe.",
    );
}
export async function saveImage(
  id: string,
  owner: string,
  url: string,
  fingerprint: string,
) {
  const row = await db()
    .prepare(
      "UPDATE her_private.launchpad_characters SET image_url=?,image_fingerprint=?,updated_at=? WHERE id=? AND wallet=? AND face_status='draft' AND mint IS NULL RETURNING id",
    )
    .bind(url, fingerprint, Date.now(), id, owner)
    .first();
  if (!row)
    throw new Error(
      "Character changed while generating. The image could not be attached.",
    );
}
export async function claimTraining(id: string, owner: string) {
  return db()
    .prepare(
      "UPDATE her_private.launchpad_characters SET face_status='submitting',updated_at=? WHERE id=? AND wallet=? AND face_status='draft' AND image_url IS NOT NULL RETURNING id",
    )
    .bind(Date.now(), id, owner)
    .first();
}
export async function faceResult(
  id: string,
  owner: string,
  faceId: string,
  status: string,
) {
  await db()
    .prepare(
      "UPDATE her_private.launchpad_characters SET face_id=?,face_status=?,updated_at=? WHERE id=? AND wallet=?",
    )
    .bind(faceId, status, Date.now(), id, owner)
    .run();
}
export type CoinIntent = {
  id: string;
  wallet: string;
  mint: string;
  message: string;
  transaction: string;
  expires: number;
  signature: string | null;
  status: string;
};
export async function coinIntent(id: string, owner: string) {
  return db()
    .prepare(
      "SELECT * FROM her_private.launchpad_coins WHERE id=? AND wallet=?",
    )
    .bind(id, owner)
    .first<CoinIntent>();
}
export async function prepareCoin(intent: CoinIntent) {
  return db()
    .prepare(
      "INSERT INTO her_private.launchpad_coins (id,wallet,mint,message,transaction,expires,status) VALUES (?,?,?,?,?,?,'prepared') ON CONFLICT (id) DO UPDATE SET mint=EXCLUDED.mint,message=EXCLUDED.message,transaction=EXCLUDED.transaction,expires=EXCLUDED.expires WHERE her_private.launchpad_coins.wallet=EXCLUDED.wallet AND her_private.launchpad_coins.status='prepared' AND her_private.launchpad_coins.expires<=? RETURNING id",
    )
    .bind(
      intent.id,
      intent.wallet,
      intent.mint,
      intent.message,
      intent.transaction,
      intent.expires,
      Date.now(),
    )
    .first();
}
export async function claimCoin(id: string, owner: string, signature: string) {
  return db()
    .prepare(
      "UPDATE her_private.launchpad_coins SET status='submitted',signature=? WHERE id=? AND wallet=? AND status='prepared' AND expires>? RETURNING id",
    )
    .bind(signature, id, owner, Date.now())
    .first();
}
export type AssetRow = {
  id: string;
  character_id: string;
  wallet: string;
  url: string;
  digest: string;
  created_at: number;
  purpose: "reference" | "pfp" | "banner";
  slot: number;
};
export async function assets(id: string, owner: string) {
  return (
    await db()
      .prepare(
        "SELECT * FROM her_private.launchpad_assets WHERE character_id=? AND wallet=? ORDER BY purpose,slot LIMIT 6",
      )
      .bind(id, owner)
      .all<AssetRow>()
  ).results;
}
export async function saveAsset(asset: AssetRow) {
  return db()
    .prepare(
      "INSERT INTO her_private.launchpad_assets (id,character_id,wallet,url,digest,created_at,purpose,slot) VALUES (?,?,?,?,?,?,?,?) ON CONFLICT (character_id,purpose,slot) DO UPDATE SET url=EXCLUDED.url,digest=EXCLUDED.digest,created_at=EXCLUDED.created_at WHERE her_private.launchpad_assets.wallet=EXCLUDED.wallet AND her_private.launchpad_assets.purpose<>'reference' RETURNING id",
    )
    .bind(
      asset.id,
      asset.character_id,
      asset.wallet,
      asset.url,
      asset.digest,
      asset.created_at,
      asset.purpose,
      asset.slot,
    )
    .first();
}
export type RenderRow = {
  id: string;
  character_id: string;
  wallet: string;
  clip_id: string;
  fingerprint: string;
  provider: string;
  provider_id: string | null;
  status: string;
  video_url: string | null;
  created_at: number;
};
export async function renders(id: string, owner: string) {
  return (
    await db().prepare("SELECT * FROM her_private.launchpad_renders WHERE character_id=? AND wallet=? ORDER BY created_at DESC LIMIT 150")
      .bind(id, owner).all<RenderRow>()
  ).results;
}
// Retain the earlier deployed query during rolling website deployments.
export async function recentRenders(id: string, owner: string) {
  return (
    await db()
      .prepare(
        "SELECT * FROM her_private.launchpad_renders WHERE character_id=? AND wallet=? ORDER BY created_at DESC LIMIT 30",
      )
      .bind(id, owner)
      .all<RenderRow>()
  ).results;
}
export async function claimRender(r: RenderRow) {
  return db()
    .prepare(
      "INSERT INTO her_private.launchpad_renders (id,character_id,wallet,clip_id,fingerprint,provider,status,created_at) VALUES (?,?,?,?,?,?,'submitting',?) ON CONFLICT (character_id,clip_id,fingerprint) DO NOTHING RETURNING id",
    )
    .bind(
      r.id,
      r.character_id,
      r.wallet,
      r.clip_id,
      r.fingerprint,
      r.provider,
      r.created_at,
    )
    .first();
}
export async function updateRender(
  id: string,
  owner: string,
  providerId: string | null,
  status: string,
  url: string | null,
) {
  await db()
    .prepare(
      "UPDATE her_private.launchpad_renders SET provider_id=?,status=?,video_url=? WHERE id=? AND wallet=?",
    )
    .bind(providerId, status, url, id, owner)
    .run();
}
export async function confirmCoin(
  id: string,
  owner: string,
  mint: string,
  signature: string,
) {
  await db().batch([
    db()
      .prepare(
        "UPDATE her_private.launchpad_coins SET status='confirmed' WHERE id=? AND wallet=? AND signature=?",
      )
      .bind(id, owner, signature),
    db()
      .prepare(
        "UPDATE her_private.launchpad_characters SET mint=?,signature=?,updated_at=? WHERE id=? AND wallet=?",
      )
      .bind(mint, signature, Date.now(), id, owner),
  ]);
}
