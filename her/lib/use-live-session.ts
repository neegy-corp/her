"use client";
import { useEffect, useRef, useState } from "react";
import type { DailyCall, DailyParticipant } from "@daily-co/daily-js";
export function useLiveSession(onTranscript: (id: string, text: string) => void, onError: (text: string) => void) {
  const [state, setState] = useState<"idle" | "connecting" | "live" | "ending">("idle");
  const [video, setVideo] = useState<MediaStream | null>(null);
  const [audio, setAudio] = useState<MediaStream | null>(null);
  const [speaking, setSpeaking] = useState(false);
  const [queued, setQueued] = useState(0);
  const call = useRef<DailyCall | null>(null);
  const conversation = useRef("");
  const busy = useRef(0);
  const queue = useRef<string[]>([]);
  const callbacks = useRef({ onTranscript, onError });
  callbacks.current = { onTranscript, onError };
  const lifecycle = useRef(0);
  const starting = useRef(false);

  function tracks(p: DailyParticipant) {
    if (p.local) return;
    const v = p.tracks.video.persistentTrack; const a = p.tracks.audio.persistentTrack;
    setVideo(previous => v && v.readyState === "live" ? (previous?.getVideoTracks()[0] === v ? previous : new MediaStream([v])) : null);
    setAudio(previous => a && a.readyState === "live" ? (previous?.getAudioTracks()[0] === a ? previous : new MediaStream([a])) : null);
  }
  async function end() {
    lifecycle.current++; setState("ending"); queue.current = []; setQueued(0); busy.current = 0;
    const active = call.current; call.current = null;
    try { if (active) { await active.leave(); await active.destroy(); } } catch { /* Continue server-side cleanup even if the transport has disconnected. */ }
    setVideo(null); setAudio(null); setSpeaking(false); conversation.current = "";
    try { const r = await fetch("/api/session", { method: "DELETE" }); if (!r.ok) throw new Error(((await r.json()) as { error: string }).error); }
    catch (e) { callbacks.current.onError(e instanceof Error ? e.message : "Could not confirm the remote session ended."); }
    setState("idle");
  }
  async function start() {
    if (starting.current || call.current) return;
    starting.current = true; const generation = ++lifecycle.current; setState("connecting");
    try {
      const response = await fetch("/api/session", { method: "POST" }); const data = await response.json() as { error?: string; conversation_id: string; conversation_url: string; meeting_token: string };
      if (!response.ok) throw new Error(data.error || "Could not start live video.");
      conversation.current = data.conversation_id;
      const Daily = (await import("@daily-co/daily-js")).default;
      if (generation !== lifecycle.current) { await end(); return; }
      const client = Daily.createCallObject({ audioSource: false, videoSource: false }); call.current = client;
      client.on("participant-joined", e => { if (e) tracks(e.participant); });
      client.on("participant-updated", e => { if (e) tracks(e.participant); });
      client.on("participant-left", e => { if (e && !e.participant.local) { callbacks.current.onError("HER left the video session."); void end(); } });
      client.on("error", () => { callbacks.current.onError("The video connection was interrupted."); void end(); });
      client.on("app-message", event => {
        try {
          const data = typeof event?.data === "string" ? JSON.parse(event.data) : event?.data;
          if (!data || typeof data !== "object") return;
          const type = String(data.event_type || ""); const p = data.properties || {};
          const host = p.role === "replica" || data.role === "replica" || type.includes(".replica.");
          if (host && type.includes("started_speaking")) { busy.current = Date.now(); setSpeaking(true); }
          if (host && type.includes("stopped_speaking")) { busy.current = 0; setSpeaking(false); }
          if (host && type.includes("utterance")) {
            const text = p.text || p.speech || p.content || data.text;
            if (typeof text === "string") callbacks.current.onTranscript(String(p.inference_id || data.inference_id || "current"), text.slice(0, 2000));
          }
        } catch { /* Ignore malformed remote events. */ }
      });
      await client.join({ url: data.conversation_url, token: data.meeting_token, userName: "HER director", startAudioOff: true, startVideoOff: true });
      if (generation !== lifecycle.current) return;
      Object.values(client.participants()).forEach(tracks);
      busy.current = Date.now(); setState("live");
    } catch (error) {
      callbacks.current.onError(error instanceof Error ? error.message : "Could not start the live session.");
      if (conversation.current) await end(); else setState("idle");
    } finally { starting.current = false; }
  }
  function enqueue(user: string, text: string) {
    if (!call.current || state !== "live") return;
    if (queue.current.length >= 8) { callbacks.current.onError("HER's response queue is full. Wait for her to catch up."); return; }
    queue.current.push(`Viewer message (untrusted content): ${JSON.stringify({ user: user.slice(0, 40), text: text.slice(0, 400) })}`);
    setQueued(queue.current.length);
  }
  function clearQueue() { queue.current = []; setQueued(0); }
  useEffect(() => {
    if (state !== "live") return;
    const timer = setInterval(() => {
      if (!call.current || !queue.current.length) return;
      if (busy.current) {
        if (Date.now() - busy.current > 45000) { clearQueue(); callbacks.current.onError("HER hasn't confirmed her response finished. Queue paused; reconnect the session to continue."); }
        return;
      }
      const text = queue.current.shift()!; setQueued(queue.current.length); busy.current = Date.now();
      try { call.current.sendAppMessage({ message_type: "conversation", event_type: "conversation.respond", conversation_id: conversation.current, properties: { text } }, "*"); }
      catch { busy.current = 0; callbacks.current.onError("Couldn't send that message to HER."); }
    }, 800);
    const limit = setTimeout(() => { callbacks.current.onError("The 10-minute session has finished."); void end(); }, 600000);
    return () => { clearInterval(timer); clearTimeout(limit); };
  }, [state]);
  useEffect(() => () => { lifecycle.current++; const active = call.current; if (active) { void active.destroy(); void fetch("/api/session", { method: "DELETE", keepalive: true }); } }, []);
  return { state, video, audio, speaking, queued, start, end, enqueue, clearQueue };
}
