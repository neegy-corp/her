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
  Plus,
  Play,
  Trash2,
  Video,
  LoaderCircle,
} from "lucide-react";
import type { CharacterDraft } from "@/lib/launchpad";
import type { ShowPlan, ShowClip } from "@/lib/show";
import { addGeneratedScene, emptyScene } from "@/lib/creator-workflow";
import StreamCredits from "./stream-credits";
import ContinuousProgram from "./continuous-program";
type Render = {
  id: string;
  clip_id: string;
  status: string;
  video_url?: string;
};
export default function ShowEditor({
  draft,
  onChange,
  onNotice,
  servicesAvailable,
  scriptsAvailable,
  videosAvailable,
}: {
  draft: CharacterDraft;
  onChange: (show: ShowPlan) => void;
  onNotice: (s: string) => void;
  servicesAvailable: boolean;
  scriptsAvailable: boolean;
  videosAvailable: boolean;
}) {
  const [busy, setBusy] = useState(""),
    [error, setError] = useState(""),
    [renders, setRenders] = useState<Render[]>([]),
    [preview, setPreview] = useState("");
  const [preparing, setPreparing] = useState(false);
  const show = draft.show;
  useEffect(() => { setRenders([]); }, [draft.id]);
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
      <StreamCredits id={draft.id} />
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
      <p className="lp-field-note">Manage reference images on the <a href={`/create/${draft.id}/character`}>Character page</a>. Voice and setting prompts apply to every new video.</p>
      <div className="lp-show-flow">
        <span>SCRIPT</span>
        <ArrowDown size={13} />
        <span>GENERATED VIDEO</span>
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
            Higgsfield generates the performance, voice and setting from your character references, prompts and dialogue. Review each clip before publishing; voice consistency can vary.
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
                chatPause: 0,
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
            <strong>Generate new scenes while streaming.</strong>
            <small>
              Continue the show from your scripts, character prompt, voice and setting. New scenes render while prepared videos play.
            </small>
          </span>
        </label>
        {show.generative && (
          <div className="lp-clip-options">
            <label>
              Generation interval
              <StudioSelect label="Generation interval" value={show.chatWindow} onValueChange={chatWindow => onChange({...show, chatWindow})} options={[15,30,60,120].map(value => ({value, label: `${value} seconds`}))} />
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
