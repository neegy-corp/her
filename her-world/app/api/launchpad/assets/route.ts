import { put, del } from "@vercel/blob";
import { withDatabase } from "@/lib/database";
import { json, mutationGuard, setting, wallet } from "@/lib/server";
import {
  ownedDraft,
  assets,
  saveAsset,
  takeQuota,
  saveImage,
  coinIntent,
} from "@/lib/launchpad-store";
import { draftSchema, visualFingerprint } from "@/lib/launchpad";
import { digest, imageType, fundedCreator } from "@/lib/launchpad-media";
import { assetPurpose, REFERENCE_LIMIT } from "@/lib/acp-config";
export const runtime = "nodejs";
export const maxDuration = 60;
export async function POST(req: Request) {
  try {
    return await withDatabase(setting("DATABASE_URL"), async () => {
      mutationGuard(req);
      const who = await wallet(req);
      if (!who)
        return json({ error: "Connect and verify your wallet first." }, 401);
      if (
        setting("HER_LAUNCHPAD_ENABLED") !== "true" ||
        !setting("BLOB_READ_WRITE_TOKEN")
      )
        return json(
          {
            error:
              "Cloud photo storage is not connected. Your photos remain on this device.",
          },
          503,
        );
      fundedCreator(who);
      // Reject oversized/chunked payloads before buffering them on the server.
      const size = Number(req.headers.get("content-length"));
      if (!size || size > 4400000)
        return json({ error: "Choose an image under 4 MB." }, 413);
      const form = await req.formData(),
        id = String(form.get("id") || ""),
        file = form.get("image");
      const purpose = assetPurpose(form.get("purpose"));
      if (!(file instanceof File) || file.size > 4194304)
        return json({ error: "Choose an image under 4 MB." }, 400);
      const row = await ownedDraft(id, who);
      if (!row) return json({ error: "Save this character first." }, 404);
      const draft = draftSchema.parse(JSON.parse(row.document));
      const intent = await coinIntent(id, who);
      if (
        purpose !== "reference" &&
        (row.mint ||
          (intent &&
            (intent.status !== "prepared" || intent.expires > Date.now())))
      )
        throw new Error(
          "Coin artwork is locked during launch and after deployment.",
        );
      if (!draft.rightsConfirmed)
        throw new Error("Confirm that you have permission to use this image.");
      const bytes = Buffer.from(await file.arrayBuffer()),
        type = imageType(bytes);
      if (!type)
        return json(
          { error: "Only PNG, JPEG and WebP images are accepted." },
          400,
        );
      const hash = digest(bytes),
        existing = (await assets(id, who)).filter((a) => a.purpose === purpose);
      const duplicate = existing.find((a) => a.digest === hash);
      if (duplicate)
        return json({ uploaded: true, url: duplicate.url, purpose });
      const slot =
        purpose === "reference"
          ? Array.from({ length: REFERENCE_LIMIT }, (_, i) => i).find(
              (i) => !existing.some((a) => a.slot === i),
            )
          : 0;
      if (slot === undefined)
        throw new Error("This character already has four reference photos.");
      await takeQuota(`upload:${who}`, 15);
      const result = await put(
        `characters/${id}/${purpose}-${crypto.randomUUID()}.${type.ext}`,
        bytes,
        { access: "public", contentType: type.mime, addRandomSuffix: true },
      );
      const saved = await saveAsset({
        id: crypto.randomUUID(),
        character_id: id,
        wallet: who,
        url: result.url,
        digest: hash,
        created_at: Date.now(),
        purpose,
        slot,
      });
      if (!saved) {
        await del(result.url);
        throw new Error(
          "Another upload filled this reference slot. Refresh before adding another photo.",
        );
      }
      const first =
        purpose === "reference" &&
        !row.image_url &&
        row.face_status === "draft" &&
        !row.mint;
      if (first) await saveImage(id, who, result.url, visualFingerprint(draft));
      return json({
        uploaded: true,
        url: result.url,
        purpose,
        ...(first
          ? { image: result.url, imageFingerprint: visualFingerprint(draft) }
          : {}),
      });
    });
  } catch (e) {
    return json(
      { error: e instanceof Error ? e.message : "Photo upload unavailable." },
      400,
    );
  }
}
