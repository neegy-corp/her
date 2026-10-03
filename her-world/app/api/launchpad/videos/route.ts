import { withDatabase } from "@/lib/database";
import { json, mutationGuard, setting, wallet } from "@/lib/server";
import {
  ownedDraft,
  assets,
  renders,
  claimRender,
  updateRender,
  takeQuota,
} from "@/lib/launchpad-store";
import { draftSchema } from "@/lib/launchpad";
import { clipSchema } from "@/lib/show";
import {
  digest,
  fundedCreator,
  falClient,
  KLING,
  tavusVideo,
  performanceInput,
  safeVideoUrl,
} from "@/lib/launchpad-media";
import { HF_VIDEO, PORTRAIT_CLIP, higgsfield, hfVideoInput, persistHfMedia } from "@/lib/higgsfield";
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
        const document = draftSchema.safeParse(JSON.parse(row.document));
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
            const current = !!clip && (r.fingerprint === digest(JSON.stringify({ clip, images: inputImages, face: row.face_id, provider: r.provider })) || (r.provider !== "higgsfield" && r.fingerprint === digest(JSON.stringify({ clip, images: inputImages, face: row.face_id }))));
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
      const draft = draftSchema.parse(JSON.parse(row.document));
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
      const provider = clip.mode === "speech" && row.face_status === "ready" && row.face_id && setting("TAVUS_API_KEY") ? "tavus" : setting("HF_API_KEY") ? "higgsfield" : clip.mode === "speech" ? "tavus" : "fal";
      if (
        provider === "tavus" &&
        (!row.face_id ||
          row.face_status !== "ready" ||
          !setting("TAVUS_API_KEY"))
      )
        throw new Error(
          "Train this character’s face before rendering scripted speech.",
        );
      if (clip.mode === "performance" && !setting("FAL_KEY") && !setting("HF_API_KEY"))
        throw new Error("The motion video provider is not connected.");
      if (provider === "higgsfield" && !setting("BLOB_READ_WRITE_TOKEN")) throw new Error("Generated video storage is not connected.");
      if (!clip.script.trim() && !clip.direction.trim())
        throw new Error("Write a script or stage direction first.");
      if (clip.mode === "speech" && !clip.script.trim())
        throw new Error("Write the words this character should say.");
      const fingerprint = digest(
        JSON.stringify({ clip, images, face: row.face_id, provider }),
      );
      const existing = (await renders(id, who)).find(
        (r) => r.clip_id === clip.id && r.fingerprint === fingerprint,
      );
      if (existing) return json({ id: existing.id, status: existing.status });
      await takeQuota(`video:${who}`, 80);
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
      if (!(await claimRender(render)))
        return json(
          {
            error: "This scene is already being generated. Refresh its status.",
          },
          409,
        );
      // Persist before any charge. A timeout remains submitting; never automatically submit twice.
      const requestId =
        provider === "tavus"
          ? (
              await tavusVideo("", {
                replica_id: row.face_id,
                script: clip.script,
                video_name: `${draft.name}: ${clip.title}`,
              })
            ).video_id
          : provider === "higgsfield" ? (await higgsfield(HF_VIDEO, hfVideoInput(clip, images))).request_id : (
              await falClient().queue.submit(KLING, {
                input: performanceInput(clip, images),
              })
            ).request_id;
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
