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
import {
  digest,
  fundedCreator,
  falClient,
  KLING,
  tavusVideo,
  performanceInput,
  safeVideoUrl,
} from "@/lib/launchpad-media";
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
        const saved = await renders(id, who);
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
          renders: saved.map(({ id, clip_id, status, video_url }) => ({
            id,
            clip_id,
            status,
            video_url,
          })),
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
      const clip = draft.show.clips.find((c) => c.id === body.clipId);
      if (!clip) throw new Error("Save this scene before generating it.");
      const refs = await assets(id, who),
        images = [
          ...(row.image_url ? [row.image_url] : []),
          ...refs.map((a) => a.url),
        ]
          .filter((url, i, all) => all.indexOf(url) === i)
          .slice(0, 3);
      if (!images.length)
        throw new Error(
          "Upload a reference photo or generate your portrait first.",
        );
      if (
        clip.mode === "speech" &&
        (!row.face_id ||
          row.face_status !== "ready" ||
          !setting("TAVUS_API_KEY"))
      )
        throw new Error(
          "Train this character’s face before rendering scripted speech.",
        );
      if (clip.mode === "performance" && !setting("FAL_KEY"))
        throw new Error("The motion video provider is not connected.");
      if (!clip.script.trim() && !clip.direction.trim())
        throw new Error("Write a script or stage direction first.");
      if (clip.mode === "speech" && !clip.script.trim())
        throw new Error("Write the words this character should say.");
      const fingerprint = digest(
        JSON.stringify({ clip, images, face: row.face_id }),
      );
      const existing = (await renders(id, who)).find(
        (r) => r.clip_id === clip.id && r.fingerprint === fingerprint,
      );
      if (existing) return json({ id: existing.id, status: existing.status });
      await takeQuota(`video:${who}`, 20);
      const render = {
        id: crypto.randomUUID(),
        character_id: id,
        wallet: who,
        clip_id: clip.id,
        fingerprint,
        provider: clip.mode === "speech" ? "tavus" : "fal",
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
        clip.mode === "speech"
          ? (
              await tavusVideo("", {
                replica_id: row.face_id,
                script: clip.script,
                video_name: `${draft.name}: ${clip.title}`,
              })
            ).video_id
          : (
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
