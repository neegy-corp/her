"use client";
import { useEffect, useRef, useState } from "react";
import { preparedSeconds, type ShowPlan, type ShowClip } from "@/lib/show";
import type { CharacterDraft } from "@/lib/launchpad";

type Render = { clip_id: string; status: string; current?: boolean };
export default function ContinuousProgram({ draft, onChange, onBusy }: {
  draft: CharacterDraft; onChange: (show: ShowPlan) => void; onBusy: (busy: boolean) => void;
}) {
  const [working, setWorking] = useState(false), [status, setStatus] = useState("");
  const controller = useRef<AbortController | null>(null);
  useEffect(() => () => controller.current?.abort(), [draft.id]);
  async function prepare() {
    const abort = new AbortController(); controller.current = abort;
    setWorking(true); onBusy(true);
    let current = { ...draft, show: { ...draft.show, continuous: true, bufferMinutes: draft.show.bufferMinutes || 5 as const, clips: [...draft.show.clips] } };
    const request = async (path: string, body?: unknown) => {
      const r = await fetch(`/api/launchpad${path}`, { method: body ? "POST" : "GET", headers: body ? { "Content-Type": "application/json" } : {}, body: body ? JSON.stringify(body) : undefined, signal: abort.signal });
      const value = await r.json() as { error?: string; clip?: ShowClip; renders?: Render[] }; if (!r.ok) throw new Error(value.error || "Preparation failed."); return value;
    };
    try {
      await request("?action=save", { draft: current });
      const target = current.show.bufferMinutes * 60;
      while (preparedSeconds(current.show) < target) {
        if (current.show.clips.length >= 48) throw new Error("Use longer scenes to fit the buffer within 48 clips.");
        setStatus(`Writing scene ${current.show.clips.length + 1} for the ${current.show.bufferMinutes}-minute buffer…`);
        const { clip } = await request("/scripts", { id: draft.id, mode: "script", brief: `Continue the same character's show with a distinct 15-second scene. Do not repeat an introduction. Same outfit, setting and personality. Prior dialogue: ${current.show.clips.slice(-5).map(c => c.script).join(" | ").slice(-650)}` });
        if (!clip) throw new Error("The script service returned no scene.");
        clip.duration = 15; clip.chatPause = 0;
        current = { ...current, updatedAt: Date.now(), show: { ...current.show, clips: [...current.show.clips, clip] } };
        await request("?action=save", { draft: current }); onChange(current.show);
      }
      const attempted = new Set<string>();
      while (!abort.signal.aborted) {
        const result = await request(`/videos?id=${draft.id}`);
        const jobs = (result.renders || []).filter(j => j.current !== false);
        const state = (id: string) => jobs.find(j => j.clip_id === id)?.status;
        const ready = current.show.clips.filter(c => state(c.id) === "ready");
        setStatus(`${ready.length}/${current.show.clips.length} scenes ready. Keep this page open; only two renders run at once.`);
        if (ready.length === current.show.clips.length) { setStatus(`${current.show.bufferMinutes}-minute buffer ready. Open the broadcast studio.`); break; }
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
  return <section className="lp-generative" aria-label="Continuous livestream">
    <label className="lp-check"><input type="checkbox" checked={!!draft.show.continuous} disabled={working} onChange={e => onChange({ ...draft.show, continuous: e.target.checked, bufferMinutes: draft.show.bufferMinutes || 5 })} /><span><strong>Continuous livestream</strong><small>Prepare fresh scenes before going live, then generate new scenes in the background. No automatic stream shutdown.</small></span></label>
    {draft.show.continuous && <>
      <label>Fresh video buffer <select disabled={working} value={draft.show.bufferMinutes || 5} onChange={e => onChange({ ...draft.show, bufferMinutes: Number(e.target.value) as 5 | 10 })}><option value={5}>5 minutes</option><option value={10}>10 minutes</option></select></label>
      <p>{Math.floor(preparedSeconds(draft.show))} seconds planned. Building the full buffer uses paid script and video credits. Rendering may take significantly longer than playback.</p>
      <button className="lp-primary" disabled={working || !draft.rightsConfirmed} onClick={() => void prepare()}>Prepare / resume {draft.show.bufferMinutes || 5}-minute show</button>
      {working && <button className="lp-secondary" onClick={() => controller.current?.abort()}>Pause preparation</button>}
      <p>During the stream, the new-video limit below caps additional paid generations. If credits, that limit, or rendering speed run out, prepared scenes replay with a visible replay label. Keep the studio browser open.</p>
    </>}
    {status && <p role="status">{status}</p>}
  </section>;
}
