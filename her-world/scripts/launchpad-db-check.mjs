// Explicit integration check. Writes only a fresh unfunded fixture; prints no credentials.
import assert from "node:assert/strict";
import { registerHooks } from "node:module";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import nextEnv from "@next/env";
import { Keypair } from "@solana/web3.js";
nextEnv.loadEnvConfig(process.cwd(), false, { info() {}, error() {} });
const root = new URL("../", import.meta.url);
registerHooks({
  resolve(specifier, context, next) {
    if (specifier.startsWith("@/"))
      specifier = new URL(specifier.slice(2), root).href;
    if (
      (specifier.startsWith(".") || specifier.startsWith("file:")) &&
      context.parentURL?.startsWith(root.href)
    ) {
      const u = new URL(specifier, context.parentURL);
      if (
        !u.pathname.endsWith(".ts") &&
        existsSync(fileURLToPath(`${u.href}.ts`))
      )
        specifier = `${u.href}.ts`;
    }
    return next(specifier, context);
  },
});
const { withDatabase } = await import("../lib/database.ts"),
  store = await import("../lib/launchpad-store.ts"),
  { newDraft } = await import("../lib/launchpad.ts");
const draft = newDraft(),
  owner = Keypair.generate().publicKey.toBase58(),
  other = Keypair.generate().publicKey.toBase58();
await withDatabase(process.env.DATABASE_URL, async () => {
  await store.saveDraft(draft, owner);
  assert.equal((await store.ownedDraft(draft.id, owner)).wallet, owner);
  assert.equal(await store.ownedDraft(draft.id, other), null);
  await assert.rejects(() =>
    store.saveDraft({ ...draft, name: "Cross-owner overwrite" }, other),
  );
  const edited = {
    ...draft,
    description: "Integration fixture: remove after verification.",
  };
  await store.saveDraft(edited, owner);
  assert.equal(
    JSON.parse((await store.ownedDraft(draft.id, owner)).document).description,
    edited.description,
  );
  const job = {
    id: crypto.randomUUID(),
    character_id: draft.id,
    wallet: owner,
    clip_id: draft.show.clips[0].id,
    fingerprint: "test-fixture",
    provider: "fal",
    provider_id: null,
    status: "submitting",
    video_url: null,
    created_at: Date.now(),
  };
  assert.ok(await store.claimRender(job));
  assert.equal(
    await store.claimRender({ ...job, id: crypto.randomUUID() }),
    null,
  );
  assert.equal((await store.renders(draft.id, other)).length, 0);
  const photo = {
    character_id: draft.id,
    wallet: owner,
    digest: "identical-test-content",
    created_at: Date.now(),
  };
  for (let slot = 0; slot < 4; slot++)
    assert.ok(
      await store.saveAsset({
        ...photo,
        id: crypto.randomUUID(),
        purpose: "reference",
        slot,
        digest: `reference-${slot}`,
        url: `https://example.com/reference-${slot}.png`,
      }),
    );
  assert.equal(
    await store.saveAsset({
      ...photo,
      id: crypto.randomUUID(),
      purpose: "reference",
      slot: 0,
      digest: "racing-upload",
      url: "https://example.com/race.png",
    }),
    null,
  );
  await assert.rejects(() =>
    store.saveAsset({
      ...photo,
      id: crypto.randomUUID(),
      purpose: "reference",
      slot: 4,
      digest: "overflow",
      url: "https://example.com/overflow.png",
    }),
  );
  for (const purpose of ["pfp", "banner"])
    assert.ok(
      await store.saveAsset({
        ...photo,
        id: crypto.randomUUID(),
        purpose,
        slot: 0,
        url: `https://example.com/${purpose}.png`,
      }),
    );
  const stored = await store.assets(draft.id, owner);
  assert.equal(stored.filter((a) => a.purpose === "reference").length, 4);
  assert.equal(stored.length, 6);
  assert.equal((await store.assets(draft.id, other)).length, 0);
  await store.saveDraft(
    {
      ...edited,
      coinPfp: "https://example.com/pfp.png",
      coinBanner: "https://example.com/banner.png",
    },
    owner,
  );
  assert.equal((await store.ownedDraft(draft.id, owner)).image_url, null);
  const longShow = { ...edited, show: { ...edited.show, continuous: true, bufferMinutes: 10,
    clips: Array.from({ length: 40 }, () => ({ ...edited.show.clips[0], id: crypto.randomUUID(), duration: 15, direction: 'Camera direction. '.repeat(35) })) } };
  assert.ok(JSON.stringify(longShow).length > 24000);
  await store.saveDraft(longShow, owner);
  assert.equal(JSON.parse((await store.ownedDraft(draft.id, owner)).document).show.clips.length, 40);
  await assert.rejects(() =>
    store.saveDraft(
      { ...edited, coinPfp: "https://example.com/not-owned.png" },
      owner,
    ),
  );
  console.log(
    JSON.stringify({
      verified: true,
      fixture: draft.id,
      checks: [
        "durable draft read/write",
        "ten-minute 40-scene document through the deployed gateway",
        "cross-owner read/write denied",
        "atomic duplicate render claim",
        "cross-owner renders denied",
        "four reference slots enforced under duplicate and overflow writes",
        "PFP and banner stored separately from character reference images",
        "cross-owner artwork reads denied",
        "unowned artwork URLs rejected",
      ],
    }),
  );
});
