import { put } from "@vercel/blob";
import { withDatabase } from "@/lib/database";
import { json, mutationGuard, setting, wallet } from "@/lib/server";
import {
  ownedDraft,
  assets,
  saveAsset,
  takeQuota,
  saveImage,
} from "@/lib/launchpad-store";
import { draftSchema, visualFingerprint } from "@/lib/launchpad";
import { digest, imageType, fundedCreator } from "@/lib/launchpad-media";
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
      if (!(file instanceof File) || file.size > 4194304)
        return json({ error: "Choose an image under 4 MB." }, 400);
      const row = await ownedDraft(id, who);
      if (!row) return json({ error: "Save this character first." }, 404);
      const draft = draftSchema.parse(JSON.parse(row.document));
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
        existing = await assets(id, who);
      if (existing.some((a) => a.digest === hash))
        return json({ uploaded: true });
      if (existing.length >= 3)
        throw new Error("This character already has three reference photos.");
      await takeQuota(`upload:${who}`, 15);
      const result = await put(
        `characters/${id}/reference-${crypto.randomUUID()}.${type.ext}`,
        bytes,
        { access: "public", contentType: type.mime, addRandomSuffix: true },
      );
      await saveAsset({
        id: crypto.randomUUID(),
        character_id: id,
        wallet: who,
        url: result.url,
        digest: hash,
        created_at: Date.now(),
      });
      const first = !row.image_url && row.face_status === "draft" && !row.mint;
      if (first) await saveImage(id, who, result.url, visualFingerprint(draft));
      return json({
        uploaded: true,
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
