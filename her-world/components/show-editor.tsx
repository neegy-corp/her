"use client";
import { useEffect, useState } from "react";
import {
  ArrowDown,
  ArrowUp,
  ImagePlus,
  Plus,
  Play,
  Trash2,
  Video,
  Upload,
  LoaderCircle,
} from "lucide-react";
import type { CharacterDraft } from "@/lib/launchpad";
import type { ShowPlan, ShowClip } from "@/lib/show";
import { REFERENCE_LIMIT } from "@/lib/acp-config";
import ContinuousProgram from "./continuous-program";
type RefPhoto = { id: string; name: string; file: Blob };
type Render = {
  id: string;
  clip_id: string;
  status: string;
  video_url?: string;
};
function photoDB() {
  return new Promise<IDBDatabase>((resolve, reject) => {
    const r = indexedDB.open("her-reference-photos", 1);
    r.onupgradeneeded = () =>
      r.result.createObjectStore("photos", { keyPath: "id" });
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(r.error);
  });
}
async function readPhotos(draftId: string) {
  const db = await photoDB();
  try {
    return await new Promise<RefPhoto[]>((resolve, reject) => {
      const r = db.transaction("photos").objectStore("photos").getAll();
      r.onsuccess = () =>
        resolve(
          r.result.filter((v: { draftId: string }) => v.draftId === draftId),
        );
      r.onerror = () => reject(r.error);
    });
  } finally {
    db.close();
  }
}
async function storePhoto(draftId: string, file: File) {
  const db = await photoDB();
  try {
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction("photos", "readwrite");
      tx.objectStore("photos").put({
        id: crypto.randomUUID(),
        draftId,
        name: file.name,
        file,
      });
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } finally {
    db.close();
  }
}
export default function ShowEditor({
  draft,
  onChange,
  onNotice,
  onImage,
}: {
  draft: CharacterDraft;
  onChange: (show: ShowPlan) => void;
  onNotice: (s: string) => void;
  onImage: (image: { image: string; imageFingerprint: string }) => void;
}) {
  const [photos, setPhotos] = useState<(RefPhoto & { url: string })[]>([]),
    [busy, setBusy] = useState(""),
    [error, setError] = useState(""),
    [renders, setRenders] = useState<Render[]>([]),
    [preview, setPreview] = useState("");
  const [preparing, setPreparing] = useState(false);
  const show = draft.show;
  useEffect(
    () => () => photos.forEach((photo) => URL.revokeObjectURL(photo.url)),
    [photos],
  );
  useEffect(() => {
    let active = true;
    void readPhotos(draft.id)
      .then((rows) => {
        if (!active) return;
        const result = rows.map((r) => ({
          ...r,
          url: URL.createObjectURL(r.file),
        }));
        setPhotos(result);
      })
      .catch(() =>
        setError("Reference image storage is unavailable in this browser."),
      );
    setRenders([]);
    return () => {
      active = false;
    };
  }, [draft.id]);
  const update = (id: string, patch: Partial<ShowClip>) =>
    onChange({
      ...show,
      clips: show.clips.map((c) => (c.id === id ? { ...c, ...patch } : c)),
    });
  function move(index: number, by: number) {
    const next = [...show.clips];
    [next[index], next[index + by]] = [next[index + by], next[index]];
    onChange({ ...show, clips: next });
  }
  async function addPhoto(file: File) {
    setError("");
    if (
      !["image/png", "image/jpeg", "image/webp"].includes(file.type) ||
      file.size > 4 * 1024 * 1024
    ) {
      setError("Choose a PNG, JPEG or WebP under 4 MB.");
      return;
    }
    if (photos.length >= REFERENCE_LIMIT) {
      setError(
        "Use one frontal photo and up to three additional reference views.",
      );
      return;
    }
    try {
      await storePhoto(draft.id, file);
      const rows = await readPhotos(draft.id);
      setPhotos(rows.map((r) => ({ ...r, url: URL.createObjectURL(r.file) })));
      onNotice(
        "Reference photo saved on this device. Upload it before generating video.",
      );
    } catch {
      setError("Could not save this photo. Browser storage may be full.");
    }
  }
  async function call(action: string, body?: unknown) {
    const r = await fetch(
      `/api/launchpad${action}`,
      body
        ? {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body),
          }
        : {},
    );
    const d = (await r.json()) as { error?: string; renders?: Render[] };
    if (!r.ok) throw new Error(d.error || "Video service unavailable.");
    return d;
  }
  async function upload(photo: RefPhoto) {
    setBusy(photo.id);
    setError("");
    try {
      if (!draft.rightsConfirmed)
        throw new Error(
          "Confirm your character image rights in the Character tab first.",
        );
      await call("?action=save", { draft });
      const form = new FormData();
      form.set("id", draft.id);
      form.set("image", photo.file, photo.name);
      const r = await fetch("/api/launchpad/assets", {
        method: "POST",
        body: form,
      });
      const data = (await r.json()) as {
        error?: string;
        image?: string;
        imageFingerprint?: string;
      };
      if (!r.ok) throw new Error(data.error || "Photo upload unavailable.");
      if (data.image && data.imageFingerprint)
        onImage({ image: data.image, imageFingerprint: data.imageFingerprint });
      onNotice("Reference photo uploaded to your character.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Upload unavailable.");
    } finally {
      setBusy("");
    }
  }
  async function render(clip: ShowClip) {
    setBusy(clip.id);
    setError("");
    try {
      await call("?action=save", { draft });
      await call("/videos", { id: draft.id, clipId: clip.id });
      onNotice("Video generation queued. Refresh renders to check progress.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Generation unavailable.");
    } finally {
      setBusy("");
    }
  }
  async function refresh() {
    setBusy("refresh");
    setError("");
    try {
      const result = await call(`/videos?id=${draft.id}`);
      setRenders(result.renders || []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not check videos.");
    } finally {
      setBusy("");
    }
  }
  async function writeScene() {
    if (show.clips.length >= 48) {
      setError("This show already has 48 scenes.");
      return;
    }
    setBusy("script");
    setError("");
    try {
      await call("?action=save", { draft });
      const response = await fetch("/api/launchpad/scripts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: draft.id,
          mode: "script",
          brief: draft.description,
        }),
      });
      const result = (await response.json()) as {
        error?: string;
        clip: ShowClip;
      };
      if (!response.ok)
        throw new Error(result.error || "Script generation unavailable.");
      onChange({ ...show, clips: [...show.clips, result.clip] });
      onNotice(
        "AI scene added. Review its script and direction before generating the video.",
      );
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : "Script generation unavailable.",
      );
    } finally {
      setBusy("");
    }
  }
  return (
    <div className="lp-show">
      <ContinuousProgram draft={draft} onChange={onChange} onBusy={setPreparing} />
      <fieldset disabled={preparing} style={{ border: 0, padding: 0, margin: 0, minWidth: 0 }}>
      <div className="lp-form-heading">
        <div>
          <span className="lp-kicker">
            WRITE THE SHOW. LET CHAT TAKE IT FROM THERE.
          </span>
          <h3>Give your character a story.</h3>
        </div>
        <Video size={24} />
      </div>
      <button
        className="lp-secondary"
        disabled={!!busy || show.clips.length >= 48}
        onClick={() => void writeScene()}
      >
        {busy === "script" ? "Writing scene…" : "Write a scene with AI"}
      </button>
      <div className="lp-photo-upload">
        <label>
          <ImagePlus size={23} />
          <strong>Upload reference photos</strong>
          <span>
            One frontal photo + up to 3 additional views · 4 MB each. Uploaded
            media uses public links for video providers.
          </span>
          <input
            type="file"
            accept="image/png,image/jpeg,image/webp"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) void addPhoto(file);
              e.target.value = "";
            }}
          />
        </label>
      </div>
      {!!photos.length && (
        <div className="lp-reference-grid">
          {photos.map((p) => (
            <div key={p.id}>
              <img src={p.url} alt={p.name} />
              <span>{p.name}</span>
              <button disabled={!!busy} onClick={() => void upload(p)}>
                <Upload size={12} />{" "}
                {busy === p.id ? "Uploading…" : "Upload to character"}
              </button>
            </div>
          ))}
        </div>
      )}
      <div className="lp-show-flow">
        <span>SCRIPT</span>
        <ArrowDown size={13} />
        <span>CHAT BREAK</span>
        <ArrowDown size={13} />
        <span>NEXT SCENE</span>
      </div>
      {show.clips.map((clip, index) => (
        <section
          className="lp-clip"
          key={clip.id}
          aria-label={`Segment ${index + 1}`}
        >
          <div className="lp-clip-top">
            <span>SCENE {String(index + 1).padStart(2, "0")}</span>
            <input
              aria-label={`Scene ${index + 1} title`}
              value={clip.title}
              maxLength={60}
              onChange={(e) => update(clip.id, { title: e.target.value })}
            />
            <button
              aria-label={`Move scene ${index + 1} up`}
              disabled={index === 0}
              onClick={() => move(index, -1)}
            >
              <ArrowUp size={13} />
            </button>
            <button
              aria-label={`Move scene ${index + 1} down`}
              disabled={index === show.clips.length - 1}
              onClick={() => move(index, 1)}
            >
              <ArrowDown size={13} />
            </button>
            <button
              aria-label={`Remove scene ${index + 1}`}
              onClick={() =>
                onChange({
                  ...show,
                  clips: show.clips.filter((c) => c.id !== clip.id),
                })
              }
            >
              <Trash2 size={13} />
            </button>
          </div>
          <div className="lp-clip-mode">
            <button
              aria-pressed={clip.mode === "speech"}
              onClick={() => update(clip.id, { mode: "speech" })}
            >
              Scripted speech
            </button>
            <button
              aria-pressed={clip.mode === "performance"}
              onClick={() => update(clip.id, { mode: "performance" })}
            >
              Action / performance
            </button>
          </div>
          <label>
            What they say
            <textarea
              value={clip.script}
              maxLength={300}
              rows={3}
              onChange={(e) => update(clip.id, { script: e.target.value })}
            />
          </label>
          <label>
            What happens on screen
            <textarea
              value={clip.direction}
              maxLength={700}
              rows={2}
              onChange={(e) => update(clip.id, { direction: e.target.value })}
            />
          </label>
          <div className="lp-clip-options">
            <label>
              Clip target
              <select
                value={clip.duration}
                onChange={(e) =>
                  update(clip.id, { duration: Number(e.target.value) })
                }
              >
                {[5, 10, 15].map((n) => (
                  <option key={n} value={n}>
                    {n} seconds
                  </option>
                ))}
              </select>
            </label>
            <label>
              Chat break after
              <select
                value={clip.chatPause}
                onChange={(e) =>
                  update(clip.id, { chatPause: Number(e.target.value) })
                }
              >
                {[0, 15, 30, 60, 120].map((n) => (
                  <option key={n} value={n}>
                    {n ? n + " seconds" : "No pause"}
                  </option>
                ))}
              </select>
            </label>
            <button
              className="lp-secondary"
              disabled={!!busy}
              onClick={() => void render(clip)}
            >
              {busy === clip.id ? (
                <LoaderCircle size={14} className="lp-spin" />
              ) : (
                <Video size={14} />
              )}
              Generate clip
            </button>
          </div>
          <p className="lp-field-note">
            {clip.mode === "speech"
              ? "Tavus renders your written speech using the trained face. Speech length determines clip duration; stage direction is reserved for performance clips."
              : "Kling animates your image and direction. Generated dialogue and voice may vary; preview before publishing."}
          </p>
        </section>
      ))}
      <button
        className="lp-add-scene"
        disabled={show.clips.length >= 48}
        onClick={() =>
          onChange({
            ...show,
            clips: [
              ...show.clips,
              {
                id: crypto.randomUUID(),
                title: "Next scene",
                script: "",
                direction: "",
                duration: 10,
                chatPause: 30,
                mode: "performance",
              },
            ],
          })
        }
      >
        <Plus size={16} /> Add scene <span>{show.clips.length}/48</span>
      </button>
      <div className="lp-generative">
        <label className="lp-check">
          <input
            type="checkbox"
            checked={show.generative}
            onChange={(e) =>
              onChange({ ...show, generative: e.target.checked })
            }
          />
          <span>
            <strong>{show.continuous ? "Generate new scenes while streaming." : "Let chat write the next chapter."}</strong>
            <small>
              {show.continuous ? "Keep writing fresh scenes when chat is quiet. Viewer replies play one at a time between clips. Two renders can prepare in the background." : "After the script ends, collect suggestions and turn the strongest ideas into the next scene. One video at a time."}
            </small>
          </span>
        </label>
        {show.generative && (
          <div className="lp-clip-options">
            <label>
              Collect ideas for
              <select
                value={show.chatWindow}
                onChange={(e) =>
                  onChange({ ...show, chatWindow: Number(e.target.value) })
                }
              >
                {[15, 30, 60, 120].map((n) => (
                  <option key={n} value={n}>
                    {n} seconds
                  </option>
                ))}
              </select>
            </label>
            <label>
              New video limit
              <select
                value={show.maxGenerations}
                onChange={(e) =>
                  onChange({ ...show, maxGenerations: Number(e.target.value) })
                }
              >
                {[1, 3, 5, 10, 20].map((n) => (
                  <option key={n} value={n}>
                    {n} videos
                  </option>
                ))}
              </select>
            </label>
          </div>
        )}
        <p>
          Live chat and automatic publishing require the broadcast runner. These
          are show settings, not an active stream.
        </p>
      </div>
      <button
        className="lp-next"
        onClick={() => void refresh()}
        disabled={!!busy}
      >
        Refresh generated clips <Video size={16} />
      </button>
      {renders.map((r) => (
        <div className="lp-render-row" key={r.id}>
          <span>
            {show.clips.find((c) => c.id === r.clip_id)?.title ||
              "Earlier version"}{" "}
            · {r.status}
          </span>
          {r.video_url && (
            <button onClick={() => setPreview(r.video_url!)}>
              <Play size={14} /> Preview
            </button>
          )}
        </div>
      ))}
      {preview && (
        <video
          className="lp-video-preview"
          src={preview}
          controls
          playsInline
          onError={() =>
            setError("The video is unavailable or its provider link expired.")
          }
        />
      )}
      {error && (
        <p className="lp-feedback error" role="alert">
          {error}
        </p>
      )}
      </fieldset>
    </div>
  );
}
