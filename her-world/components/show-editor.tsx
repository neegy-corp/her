"use client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { StudioSelect } from "./studio-select";
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
import { addGeneratedScene, emptyScene } from "@/lib/creator-workflow";
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
  servicesAvailable,
  scriptsAvailable,
  videosAvailable,
}: {
  draft: CharacterDraft;
  onChange: (show: ShowPlan) => void;
  onNotice: (s: string) => void;
  onImage: (image: { image: string; imageFingerprint: string }) => void;
  servicesAvailable: boolean;
  scriptsAvailable: boolean;
  videosAvailable: boolean;
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
    if (show.clips.length >= 48 && !show.clips.some(emptyScene)) {
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
      onChange(addGeneratedScene(show, result.clip));
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
      {!servicesAvailable && <p className="lp-service-note">Connect your wallet and cloud services to generate videos. You can write your show now.</p>}
      {servicesAvailable && (!scriptsAvailable || !videosAvailable) && <p className="lp-service-note">{!scriptsAvailable ? "AI script generation is not connected. " : ""}{!videosAvailable ? "Video generation is not connected. " : ""}Your edits and uploaded media are preserved.</p>}
      <ContinuousProgram draft={draft} onChange={onChange} onBusy={setPreparing} servicesAvailable={servicesAvailable && scriptsAvailable && videosAvailable && !busy} />
      <fieldset disabled={preparing} style={{ border: 0, padding: 0, margin: 0, minWidth: 0 }}>
      <div className="lp-show-toolbar"><h3>Your scenes</h3>
      <Button
        variant="outline" className="lp-secondary"
        disabled={!!busy || (show.clips.length >= 48 && !show.clips.some(emptyScene)) || !servicesAvailable || !scriptsAvailable}
        onClick={() => void writeScene()}
      >
        {busy === "script" ? "Writing scene…" : "Write a scene with AI"}
      </Button>
      </div>
      <details className="lp-details" open={photos.length > 0 || undefined}><summary>Character reference photos</summary>
      <div className="lp-photo-upload">
        <label>
          <ImagePlus size={23} />
          <strong>Upload reference photos</strong>
          <span>
            Front view + up to 3 extra views · 4 MB each. Uploads use public provider links.
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
              <Button disabled={!!busy || !servicesAvailable} onClick={() => void upload(p)}>
                <Upload size={12} />{" "}
                {busy === p.id ? "Uploading…" : "Upload to character"}
              </Button>
            </div>
          ))}
        </div>
      )}
      </details>
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
            <Input
              aria-label={`Scene ${index + 1} title`}
              value={clip.title}
              maxLength={60}
              onChange={(e) => update(clip.id, { title: e.target.value })}
            />
            <Button
              aria-label={`Move scene ${index + 1} up`}
              disabled={index === 0}
              onClick={() => move(index, -1)}
            >
              <ArrowUp size={13} />
            </Button>
            <Button
              aria-label={`Move scene ${index + 1} down`}
              disabled={index === show.clips.length - 1}
              onClick={() => move(index, 1)}
            >
              <ArrowDown size={13} />
            </Button>
            <Button
              aria-label={`Remove scene ${index + 1}`}
              onClick={() =>
                onChange({
                  ...show,
                  clips: show.clips.filter((c) => c.id !== clip.id),
                })
              }
            >
              <Trash2 size={13} />
            </Button>
          </div>
          <div className="lp-clip-mode">
            <Button
              aria-pressed={clip.mode === "speech"}
              onClick={() => update(clip.id, { mode: "speech" })}
            >
              Speech
            </Button>
            <Button
              aria-pressed={clip.mode === "performance"}
              onClick={() => update(clip.id, { mode: "performance" })}
            >
              Performance
            </Button>
          </div>
          <label>
            Dialogue
            <Textarea
              value={clip.script}
              maxLength={300}
              rows={3}
              onChange={(e) => update(clip.id, { script: e.target.value })}
            />
          </label>
          <label>
            Action & direction
            <Textarea
              value={clip.direction}
              maxLength={700}
              rows={2}
              onChange={(e) => update(clip.id, { direction: e.target.value })}
            />
          </label>
          <div className="lp-clip-options">
            <label>
              Length
              <StudioSelect label="Clip length" value={clip.duration} onValueChange={duration => update(clip.id, {duration})} options={[5,10,15].map(value => ({value, label: `${value} seconds`}))} />
            </label>
            <label>
              Chat pause
              <StudioSelect label="Chat pause" value={clip.chatPause} onValueChange={chatPause => update(clip.id, {chatPause})} options={[0,15,30,60,120].map(value => ({value, label: value ? `${value} seconds` : "None"}))} />
            </label>
            <Button
              variant="outline" className="lp-secondary"
              disabled={!!busy || !servicesAvailable || !videosAvailable || !draft.rightsConfirmed || emptyScene(clip)}
              onClick={() => void render(clip)}
            >
              {busy === clip.id ? (
                <LoaderCircle size={14} className="lp-spin" />
              ) : (
                <Video size={14} />
              )}
              Generate clip
            </Button>
          </div>
          <details className="lp-details"><summary>Rendering details</summary><p className="lp-field-note">
            {clip.mode === "speech"
              ? "Tavus renders your written speech using the trained face. Speech length determines clip duration; stage direction is reserved for performance clips."
              : "Kling animates your image and direction. Generated dialogue and voice may vary; preview before publishing."}
          </p></details>
        </section>
      ))}
      <Button
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
      </Button>
      <details className="lp-details"><summary>Stream options</summary><div className="lp-generative">
        <label className="lp-check">
          <Checkbox aria-label="Generate new scenes while streaming" checked={show.generative} onCheckedChange={checked => onChange({...show, generative: checked === true})} />
          <span>
            <strong>{show.continuous ? "Generate new scenes while streaming." : "Let chat write the next chapter."}</strong>
            <small>
              {show.continuous ? "Recent chat becomes new scenes between clips. Quiet chat continues the story, leaving a render slot for viewers." : "After the script ends, collect suggestions and turn the strongest ideas into the next scene. One video at a time."}
            </small>
          </span>
        </label>
        {show.generative && (
          <div className="lp-clip-options">
            <label>
              Collect ideas for
              <StudioSelect label="Collect ideas for" value={show.chatWindow} onValueChange={chatWindow => onChange({...show, chatWindow})} options={[15,30,60,120].map(value => ({value, label: `${value} seconds`}))} />
            </label>
            <label>
              New video limit
              <StudioSelect label="New video limit" value={show.maxGenerations} onValueChange={maxGenerations => onChange({...show, maxGenerations})} options={[0,1,3,5,10,20].map(value => ({value, label: `${value} videos`}))} />
            </label>
          </div>
        )}
        <p>
          Changes apply when you start the broadcast studio.
        </p>
      </div>
      </details>
      <Button
        variant="ghost" className="lp-next"
        onClick={() => void refresh()}
        disabled={!!busy || !servicesAvailable}
      >
        Check clips <Video size={16} />
      </Button>
      {renders.map((r) => (
        <div className="lp-render-row" key={r.id}>
          <span>
            {show.clips.find((c) => c.id === r.clip_id)?.title ||
              "Earlier version"}{" "}
            · {r.status}
          </span>
          {r.video_url && (
            <Button onClick={() => setPreview(r.video_url!)}>
              <Play size={14} /> Preview
            </Button>
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
