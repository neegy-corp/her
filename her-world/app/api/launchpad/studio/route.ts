import { withDatabase } from "@/lib/database";
import { json, setting, wallet } from "@/lib/server";
import { ownedDraft, renders, assets } from "@/lib/launchpad-store";
import { mediaDraftSchema } from "@/lib/launchpad";
import { digest } from "@/lib/launchpad-media";
export const runtime = "nodejs";
export async function GET(req: Request) {
  try {
    return await withDatabase(setting("DATABASE_URL"), async () => {
      const who = await wallet(req);
      if (!who)
        return json(
          { error: "Connect and verify your wallet in the launchpad first." },
          401,
        );
      const id = new URL(req.url).searchParams.get("id") || "";
      const row = await ownedDraft(id, who);
      if (!row) return json({ error: "Character not found." }, 404);
      const draft = mediaDraftSchema.parse(JSON.parse(row.document));
      const [jobs, images] = await Promise.all([
        renders(id, who),
        assets(id, who),
      ]);
      const refs = images
        .filter((a) => a.purpose === "reference")
        .map((a) => a.url);
      const inputs = (refs.length ? refs : row.image_url ? [row.image_url] : [])
        .filter((url, i, all) => all.indexOf(url) === i)
        .slice(0, 4);
      const clips = draft.show.clips.map((clip) => {
        const legacyFingerprint = digest(
          JSON.stringify({ clip, images: inputs, face: row.face_id }),
        );
        const render = jobs.find(
          (r) =>
            r.clip_id === clip.id &&
            (r.fingerprint === digest(JSON.stringify({ clip, images: inputs, face: row.face_id, provider: r.provider })) ||
              (r.provider !== "higgsfield" && r.fingerprint === legacyFingerprint)) &&
            r.status === "ready" &&
            r.video_url,
        );
        return render ? { id: clip.id, url: render.video_url } : null;
      });
      return json({
        id,
        name: draft.name,
        mint: row.mint,
        show: draft.show,
        clips: clips.filter(Boolean),
        ready: clips.length > 0 && clips.every(Boolean),
        broadcastVerified: false,
      });
    });
  } catch {
    return json({ error: "Studio manifest unavailable." }, 503);
  }
}
