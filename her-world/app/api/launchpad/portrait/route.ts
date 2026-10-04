import { withDatabase } from "@/lib/database";
import { json, mutationGuard, setting, wallet } from "@/lib/server";
import { ownedDraft, renders, claimRender, updateRender, saveImage, takeQuota } from "@/lib/launchpad-store";
import { localDraftSchema, visualFingerprint } from "@/lib/launchpad";
import { fundedCreator, digest } from "@/lib/launchpad-media";
import { HF_PORTRAIT, PORTRAIT_CLIP, higgsfield, hfPortraitInput, persistHfMedia } from "@/lib/higgsfield";
export const runtime = "nodejs";
export const maxDuration = 60;
async function handle(req: Request) {
  try { return await withDatabase(setting("DATABASE_URL"), async () => {
    if (req.method === "POST") mutationGuard(req);
    const who = await wallet(req);
    if (!who) return json({ error: "Connect and verify your wallet first." }, 401);
    if (setting("HER_LAUNCHPAD_ENABLED") !== "true") return json({ error: "Cloud generation is not activated." }, 503);
    const id = new URL(req.url).searchParams.get("id") || "";
    const row = await ownedDraft(id, who);
    if (!row) return json({ error: "Save this character first." }, 404);
    const draft = localDraftSchema.parse(JSON.parse(row.document));
    const visual = visualFingerprint(draft), fingerprint = digest(`${HF_PORTRAIT}:${visual}`);
    let job = (await renders(id, who)).find(r => r.clip_id === PORTRAIT_CLIP && r.fingerprint === fingerprint);
    if (req.method === "POST" && !job) {
      if (setting("HER_LAUNCHPAD_GENERATION_ENABLED") !== "true" || !setting("HF_API_KEY") || !setting("BLOB_READ_WRITE_TOKEN")) return json({ error: "Higgsfield portrait credits are not connected. No generation was submitted." }, 503);
      fundedCreator(who);
      if (draft.appearance.trim().length < 20 || draft.background.trim().length < 10) throw new Error("Describe the character's appearance and choose a background in Voice & setting first.");
      if (!draft.rightsConfirmed || row.face_status !== "draft" || row.mint) throw new Error("Confirm image rights; a launched or trained character's image cannot change.");
      await takeQuota(`image:${who}`, 5);
      job = { id: crypto.randomUUID(), character_id: id, wallet: who, clip_id: PORTRAIT_CLIP, fingerprint, provider: "higgsfield", provider_id: null, status: "submitting", video_url: null, created_at: Date.now() };
      if (!(await claimRender(job))) return json({ status: "submitting" });
      const submitted = await higgsfield(HF_PORTRAIT, hfPortraitInput(draft));
      if (!submitted.request_id) throw new Error("Submission needs reconciliation. Do not submit another portrait.");
      await updateRender(job.id, who, submitted.request_id, "queued", null);
      return json({ status: "queued" });
    }
    if (!job) return json({ status: "none" });
    if (job.status === "queued" && job.provider_id) {
      const result = await higgsfield(`requests/${encodeURIComponent(job.provider_id)}/status`);
      if (result.status === "completed" && result.images?.[0]?.url) {
        const url = await persistHfMedia(result.images[0].url, id, job.id, "image");
        await updateRender(job.id, who, job.provider_id, "ready", url);
        job.status = "ready"; job.video_url = url;
      } else if (["failed", "nsfw", "canceled"].includes(result.status || "")) {
        await updateRender(job.id, who, job.provider_id, "failed", null); job.status = "failed";
      }
    }
    if (job.status === "ready" && job.video_url) {
      const current = await ownedDraft(id, who);
      if (current && current.image_url !== job.video_url && visualFingerprint(localDraftSchema.parse(JSON.parse(current.document))) === visual && current.face_status === "draft" && !current.mint)
        await saveImage(id, who, job.video_url, visual);
      return json({ status: "ready", image: job.video_url, imageFingerprint: visual });
    }
    return json({ status: job.status });
  }); } catch (e) { return json({ error: e instanceof Error ? e.message : "Portrait service unavailable." }, 400); }
}
export const GET = handle;
export const POST = handle;
