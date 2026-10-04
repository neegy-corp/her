"use client";
import { useEffect, useRef, useState } from "react";
import { addGeneratedScene, emptyScene } from "@/lib/creator-workflow";
import { preparedSeconds, type ShowPlan, type ShowClip } from "@/lib/show";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Radio } from "lucide-react";
import type { CharacterDraft } from "@/lib/launchpad";

type Render = { clip_id: string; status: string; current?: boolean };
export default function ContinuousProgram({ draft, onChange, onBusy, servicesAvailable }: {
  draft: CharacterDraft; onChange: (show: ShowPlan) => void; onBusy: (busy: boolean) => void;
  servicesAvailable: boolean;
}) {
  const [working, setWorking] = useState(false), [status, setStatus] = useState("");
  const controller = useRef<AbortController | null>(null);
  useEffect(() => () => controller.current?.abort(), [draft.id]);
  useEffect(() => {if(draft.show.continuous && draft.show.bufferMinutes !== 10) onChange({...draft.show, bufferMinutes: 10});}, [draft.show, onChange]);
  async function prepare() {
    const abort = new AbortController(); controller.current = abort;
    setWorking(true); onBusy(true);
    let current: CharacterDraft = { ...draft, show: { ...draft.show, continuous: true, bufferMinutes: 10 as const, clips: [...draft.show.clips] } };
    const request = async (path: string, body?: unknown) => {
      const r = await fetch(`/api/launchpad${path}`, { method: body ? "POST" : "GET", headers: body ? { "Content-Type": "application/json" } : {}, body: body ? JSON.stringify(body) : undefined, signal: abort.signal });
      const value = await r.json() as { error?: string; clip?: ShowClip; renders?: Render[] }; if (!r.ok) throw new Error(value.error || "Preparation failed."); return value;
    };
    try {
      await request("?action=save", { draft: current });
      const target = 10 * 60;
      while (current.show.clips.some(emptyScene) || preparedSeconds(current.show) < target) {
        if (current.show.clips.length >= 48 && !current.show.clips.some(emptyScene)) throw new Error("Use longer scenes to keep the show within 48 clips.");
        setStatus(`Writing scene ${current.show.clips.length + 1} for your show…`);
        const { clip } = await request("/scripts", { id: draft.id, mode: "script", brief: `Continue the same character's show with a distinct 15-second scene. Do not repeat an introduction. Same outfit, setting and personality. Prior dialogue: ${current.show.clips.slice(-5).map(c => c.script).join(" | ").slice(-650)}` });
        if (!clip) throw new Error("The script service returned no scene.");
        clip.duration = 15; clip.chatPause = 0;
        current = { ...current, updatedAt: Date.now(), show: addGeneratedScene(current.show, clip) };
        await request("?action=save", { draft: current }); onChange(current.show);
      }
      const attempted = new Set<string>();
      while (!abort.signal.aborted) {
        const result = await request(`/videos?id=${draft.id}`);
        const jobs = (result.renders || []).filter(j => j.current !== false);
        const state = (id: string) => jobs.find(j => j.clip_id === id)?.status;
        const ready = current.show.clips.filter(c => state(c.id) === "ready");
        setStatus(`${ready.length}/${current.show.clips.length} scenes ready. Preparation is running. Keep this page open.`);
        if (ready.length === current.show.clips.length) { setStatus(`Your show is ready. Open the broadcast studio.`); break; }
        if (current.show.clips.some(c => ["failed", "submitting"].includes(state(c.id) || ""))) throw new Error("A saved render needs review. Preparation paused without resubmitting it.");
        let active = (result.renders || []).filter(j => j.status === "queued" || j.status === "submitting").length;
        for (const clip of current.show.clips) {
          if (active >= 2) break;
          if (!state(clip.id) && !attempted.has(clip.id)) {
            attempted.add(clip.id);
            await request("/videos", { id: draft.id, clipId: clip.id }); active++;
          }
        }
        await new Promise<void>((resolve, reject) => {
          const cancel = () => { clearTimeout(timer); reject(new Error("Preparation paused. Already submitted renders can still complete.")); };
          const timer = setTimeout(() => { abort.signal.removeEventListener("abort", cancel); resolve(); }, 10000);
          abort.signal.addEventListener("abort", cancel, { once: true });
          if (abort.signal.aborted) cancel();
        });
      }
    } catch (e) { setStatus(abort.signal.aborted ? "Preparation paused. Saved scenes and submitted renders are preserved." : e instanceof Error ? e.message : "Preparation unavailable."); }
    finally { if (controller.current === abort) { controller.current = null; setWorking(false); onBusy(false); } }
  }
  return <section className="lp-stream-setup" aria-label="Continuous livestream"><div className="lp-stream-heading"><Radio size={19} /><div><Label htmlFor="continuous-show">Continuous livestream</Label><p>Prepare 10 minutes of scenes. Keep them playing.</p></div><Switch id="continuous-show" checked={!!draft.show.continuous} disabled={working} onCheckedChange={continuous => onChange({...draft.show, continuous, bufferMinutes: 10})} /></div>{draft.show.continuous && <div className="lp-stream-actions"><Button disabled={working || !draft.rightsConfirmed || !draft.image || !servicesAvailable} onClick={() => void prepare()}>{working ? "Preparing your show…" : "Prepare show"}</Button>{working && <Button variant="outline" onClick={() => controller.current?.abort()}>Pause</Button>}<p>Generate or upload your character image first. Preparing 10 minutes uses paid credits for every new scene. Keep the studio open while live.</p><details className="lp-details"><summary>How continuous playback works</summary><p>New scenes use your generation limit. If rendering falls behind or credits run out, prepared scenes replay with a replay label.</p></details></div>}{status && <p role="status">{status}</p>}</section>;
}
