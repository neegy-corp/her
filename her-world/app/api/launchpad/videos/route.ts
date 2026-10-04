import { withDatabase } from "@/lib/database";
import { json, mutationGuard, setting, wallet } from "@/lib/server";
import {
  ownedDraft,
  assets,
  renders,
  updateRender,
  takeQuota,
} from "@/lib/launchpad-store";
import { mediaDraftSchema } from "@/lib/launchpad";
import { clipSchema } from "@/lib/show";
import {
  digest,
  fundedCreator,
  requirePaidGeneration,
  falClient,
  KLING,
  tavusVideo,
  safeVideoUrl,
} from "@/lib/launchpad-media";
import { HF_VIDEO, PORTRAIT_CLIP, higgsfield, hfVideoInput, videoGenerationKey, persistHfMedia } from "@/lib/higgsfield";
import { streamCreditsEnabled, claimCreditRender } from "@/lib/stream-credit-store";
import { VIDEO_CREDIT_EXHAUSTED } from "@/lib/stream-plans";
export const runtime = "nodejs";
export const maxDuration = 60;
async function handle(req: Request) {
  try {
    return await withDatabase(setting("DATABASE_URL"), async () => {
      if (req.method === "POST") mutationGuard(req);
      const who = await wallet(req);
      if (!who)
        return json({ error: "Connect and verify your wallet first." }, 401);
      if (setting("HER_LAUNCHPAD_ENABLED") !== "true")
        return json(
          {
            error:
              "Cloud video generation is not activated. No credits were charged.",
          },
          503,
        );
      const raw = req.method === "POST" ? await req.text() : "{}";
      if (raw.length > 3000) return json({ error: "Request too large." }, 413);
      const body = JSON.parse(raw),
        id =
          req.method === "GET"
            ? new URL(req.url).searchParams.get("id") || ""
            : body.id;
      const row = await ownedDraft(id, who);
      if (!row)
        return json(
          { error: "Save this character to your wallet first." },
          404,
        );
      if (req.method === "GET") {
        const saved = (await renders(id, who)).filter(r => r.clip_id !== PORTRAIT_CLIP);
        const document = mediaDraftSchema.safeParse(JSON.parse(row.document));
        const refAssets = await assets(id, who);
        const refUrls = refAssets.filter(a => a.purpose === "reference").map(a => a.url);
        const inputImages = (refUrls.length ? refUrls : row.image_url ? [row.image_url] : []).filter((url, i, all) => all.indexOf(url) === i).slice(0, 4);
        for (const render of saved
          .filter((r) => r.status === "queued" && r.provider_id)
          .slice(0, 4)) {
          try {
            if (render.provider === "tavus") {
              const result = await tavusVideo(
                  `/${encodeURIComponent(render.provider_id!)}`,
                ),
                url = safeVideoUrl(result.stream_url || result.download_url);
              if (result.status === "ready" && url) {
                await updateRender(
                  render.id,
                  who,
                  render.provider_id,
                  "ready",
                  url,
                );
                render.status = "ready";
                render.video_url = url;
              } else if (["error", "deleted"].includes(result.status || "")) {
                await updateRender(
                  render.id,
                  who,
                  render.provider_id,
                  "failed",
                  null,
                );
                render.status = "failed";
              }
            } else if (render.provider === "higgsfield") {
              const result = await higgsfield(`requests/${encodeURIComponent(render.provider_id!)}/status`);
              if (result.status === "completed" && result.video?.url) {
                const url = await persistHfMedia(result.video.url, id, render.id, "video");
                await updateRender(render.id, who, render.provider_id, "ready", url);
                render.status = "ready"; render.video_url = url;
              } else if (["failed", "nsfw", "canceled"].includes(result.status || "")) {
                await updateRender(render.id, who, render.provider_id, "failed", null);
                render.status = "failed";
              }
            } else {
              const client = falClient(),
                state = await client.queue.status(KLING, {
                  requestId: render.provider_id!,
                  logs: false,
                });
              if (state.status === "COMPLETED") {
                const result = await client.queue.result(KLING, {
                  requestId: render.provider_id!,
                });
                const url = safeVideoUrl(
                  (result.data as { video?: { url?: string } }).video?.url,
                );
                if (!url) throw new Error("Video result unavailable.");
                await updateRender(
                  render.id,
                  who,
                  render.provider_id,
                  "ready",
                  url,
                );
                render.status = "ready";
                render.video_url = url;
              }
            }
          } catch {
            /* Keep durable job and request ID for reconciliation; a poll error is not a new job. */
          }
        }
        return json({
          renders: saved.map(r => {
            const clip = document.success ? document.data.show.clips.find(c => c.id === r.clip_id) : undefined;
            const current = !!clip && document.success && r.fingerprint === digest(videoGenerationKey(clip,inputImages,row.face_id,r.provider,document.data));
            return { id: r.id, clip_id: r.clip_id, status: r.status, video_url: r.video_url, current };
          }),
        });
      }
      if (setting("HER_LAUNCHPAD_VIDEOS_ENABLED") !== "true")
        return json(
          {
            error:
              "Video generation credits are not connected. No credits were charged.",
          },
          503,
        );
      fundedCreator(who);
      requirePaidGeneration();
      const parsed = mediaDraftSchema.safeParse(JSON.parse(row.document));
      if (!parsed.success) throw new Error("Add a character name and check the creative prompts before generating video. A coin ticker is not needed yet.");
      const draft = parsed.data;
      if (!draft.rightsConfirmed)
        throw new Error("Confirm your character image rights first.");
      const clip = body.clip
        ? clipSchema.parse(body.clip)
        : draft.show.clips.find((c) => c.id === body.clipId);
      if (!clip) throw new Error("Save this scene before generating it.");
      const refs = await assets(id, who),
        references = refs
          .filter((a) => a.purpose === "reference")
          .map((a) => a.url),
        images = (
          references.length ? references : row.image_url ? [row.image_url] : []
        )
          .filter((url, i, all) => all.indexOf(url) === i)
          .slice(0, 4);
      if (!images.length)
        throw new Error(
          "Upload a reference photo or generate your portrait first.",
        );
      if(!setting("HF_API_KEY"))throw new Error("Connect Higgsfield generation credits before creating videos.");
      const provider = "higgsfield";
      if (!setting("BLOB_READ_WRITE_TOKEN")) throw new Error("Generated video storage is not connected.");
      if (!clip.script.trim() && !clip.direction.trim())
        throw new Error("Write a script or stage direction first.");
      if (clip.mode === "speech" && !clip.script.trim())
        throw new Error("Write the words this character should say.");
      const fingerprint = digest(
        videoGenerationKey(clip,images,row.face_id,provider,draft),
      );
      const existing = (await renders(id, who)).find(
        (r) => r.clip_id === clip.id && r.fingerprint === fingerprint,
      );
      if (existing) return json({ id: existing.id, status: existing.status });
      await takeQuota(`video:${who}`, streamCreditsEnabled() ? 500 : 80);
      const render = {
        id: crypto.randomUUID(),
        character_id: id,
        wallet: who,
        clip_id: clip.id,
        fingerprint,
        provider,
        provider_id: null,
        status: "submitting",
        video_url: null,
        created_at: Date.now(),
      };
      if (!(await claimCreditRender(render,clip.duration))) {
        // A concurrent request may have claimed this exact scene. Return its job,
        // never convert an existing paid attempt into a retryable credit error.
        const claimed = (await renders(id,who)).find(r=>r.clip_id===clip.id && r.fingerprint===fingerprint);
        if (claimed) return json({id:claimed.id,status:claimed.status});
        return json(
          {
            error: streamCreditsEnabled() ? VIDEO_CREDIT_EXHAUSTED : "This scene is already being generated. Refresh its status.",
          },
          streamCreditsEnabled() ? 402 : 409,
        );
      }
      // Persist before any charge. A timeout remains submitting; never automatically submit twice.
      const requestId = (await higgsfield(HF_VIDEO, hfVideoInput(clip, images, draft))).request_id;
      if (!requestId)
        throw new Error(
          "Submission needs reconciliation. Do not create a duplicate render.",
        );
      await updateRender(render.id, who, requestId, "queued", null);
      return json({ id: render.id, status: "queued" });
    });
  } catch (e) {
    return json(
      { error: e instanceof Error ? e.message : "Video service unavailable." },
      400,
    );
  }
}
export const GET = handle;
export const POST = handle;
