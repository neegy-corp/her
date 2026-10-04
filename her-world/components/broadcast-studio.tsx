"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { Video, ArrowLeft, ArrowUpRight } from "lucide-react";
import { toast } from "sonner";
import { Toaster } from "@/components/ui/sonner";
import { ShowRunner, type RenderedClip } from "@/lib/show-runner";
import { ContinuousShowRunner } from "@/lib/continuous-show";
import { measureMediaBuffer } from "@/lib/media-buffer";
import { preparedSeconds } from "@/lib/show";
import { WhipPublisher } from "@/lib/whip-publisher";
import type { ChatMessage, ShowClip, ShowPlan } from "@/lib/show";
import "./launchpad.css";
import StreamCredits from "./stream-credits";
import type { StreamCreditState } from "@/lib/stream-plans";
import { WalletRoot, useWallet } from "./wallet";
import {
  broadcastPreflight,
  type StudioManifest as Manifest,
} from "@/lib/broadcast-plan";
import { AcpNav, AcpFooter } from "./acp-nav";
import "./acp-pages.css";
import "./broadcast-studio.css";
async function api<T>(
  path: string,
  body?: unknown,
  signal?: AbortSignal,
): Promise<T> {
  const r = await fetch(`/api/launchpad${path}`, {
    ...(body
      ? {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        }
      : {}),
    signal,
  });
  const result = (await r.json()) as T & { error?: string };
  if (!r.ok) throw new Error(result.error || "Studio request failed.");
  return result;
}
const GUIDE_TOAST = "go-live-guide";
// Shown automatically once the show is ready, and again from "How to go live".
function showGoLiveGuide() {
  toast.info("How to go live on pump.fun", {
    id: GUIDE_TOAST,
    duration: Infinity,
    closeButton: true,
    description: (
      <ol style={{ margin: "6px 0 0", paddingLeft: 18, lineHeight: 1.5 }}>
        <li>Open your coin on pump.fun and go to its streaming settings.</li>
        <li>Copy the <b>Stream URL</b> (WHIP) and the <b>Stream key</b> into the two fields here.</li>
        <li>Press <b>Go Live</b>. Audio comes from the video itself, so no microphone or screen share is needed.</li>
        <li>For sound: leave this tab unmuted, keep the volume up, and click Go Live yourself so the browser allows audio.</li>
        <li>Keep this tab open and in front. Closing it, sleeping the device or switching tabs can interrupt the stream.</li>
        <li>Open your coin on pump.fun in another window to confirm picture and sound. Mute that window to avoid echo.</li>
      </ol>
    ),
  });
}
function delay(signal: AbortSignal) {
  return new Promise<void>((resolve, reject) => {
    const cancel = () => {
      clearTimeout(timer);
      reject(new Error("Stopped."));
    };
    const timer = setTimeout(() => {
      signal.removeEventListener("abort", cancel);
      resolve();
    }, 5000);
    signal.addEventListener("abort", cancel, { once: true });
    if (signal.aborted) cancel();
  });
}
export default function BroadcastStudio({ id }: { id: string }) {
  return (
    <WalletRoot>
      <Studio id={id} />
    </WalletRoot>
  );
}
function Studio({ id }: { id: string }) {
  const { viewer, connect } = useWallet();
  const sessionAbort = useRef<AbortController | null>(null);
  const stopping = useRef(false);
  const creditSession = useRef<string | null>(null), creditDeadline = useRef(0), checkingCreditExpiry = useRef(false);
  const [credits,setCredits] = useState<StreamCreditState | null>(null);
  const updateCredits = useCallback((value: StreamCreditState) => {
    setCredits(value);
    if (value.enabled && runner.current instanceof ContinuousShowRunner) runner.current.updateVideoAllowance(value.videoSeconds);
    if (creditSession.current) creditDeadline.current = value.sessionId === creditSession.current ? Date.now() + Math.max(0,value.endsAt-value.serverNow) : Date.now();
  },[]);
  function endCreditSession(sessionId: string) {
    void fetch(`/api/launchpad/credits?id=${encodeURIComponent(id)}&action=stop`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({sessionId}),keepalive:true}).catch(()=>{});
  }
  async function activateCredits(controller: AbortController | null) {
    if (!manifest?.creditsRequired) return;
    const sessionId=creditSession.current || crypto.randomUUID();
    try {
      const result=await api<{endsAt:number;serverNow:number}>(`/credits?id=${encodeURIComponent(id)}&action=start`,{sessionId});
      if (!controller || controller.signal.aborted || sessionAbort.current!==controller) throw new Error("Stopped.");
      creditSession.current=sessionId;
      creditDeadline.current=Date.now()+Math.max(0,result.endsAt-result.serverNow);
    } catch(error) { endCreditSession(sessionId);throw error; }
  }
  function releaseCredits() {
    const sessionId=creditSession.current;creditSession.current=null;creditDeadline.current=0;
    if (!sessionId) return;
    endCreditSession(sessionId);
  }
  const [revision, setRevision] = useState(0),
    [loading, setLoading] = useState(false),
    [layout, setLayout] = useState("portrait");
  const canvas = useRef<HTMLCanvasElement>(null);
  const runner = useRef<ShowRunner | ContinuousShowRunner | null>(null),
    publisher = useRef(new WhipPublisher());
  const cleanup = useRef<(() => void) | null>(null),
    stream = useRef<MediaStream | null>(null);
  const alive = useRef(true);
  const [manifest, setManifest] = useState<Manifest | null>(null),
    [error, setError] = useState("");
  const [active, setActive] = useState(false),
    [starting, setStarting] = useState(false),
    [phase, setPhase] = useState("stopped");
  const [endpoint, setEndpoint] = useState(""),
    [key, setKey] = useState(""),
    [publishing, setPublishing] = useState(false),
    [connected, setConnected] = useState(false),
    [health, setHealth] = useState("Not publishing");
  useEffect(() => {
    alive.current = true;
    const controller = new AbortController();
    setManifest(null);
    if (!viewer.wallet)
      return () => {
        alive.current = false;
      };
    setLoading(true);
    setError("");
    api<Manifest>(
      `/studio?id=${encodeURIComponent(id)}`,
      undefined,
      controller.signal,
    )
      .then((value) => {
        if (!controller.signal.aborted) setManifest(value);
      })
      .catch((e) => {
        if (!controller.signal.aborted) setError(e.message);
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => {
      alive.current = false;
      controller.abort();
      sessionAbort.current?.abort();
      cleanup.current?.();
      setActive(false);
      setConnected(false);
      setKey("");
      void publisher.current.stop();
    };
  }, [id, viewer.wallet, revision]);
  const guideShown = useRef(false);
  useEffect(() => {
    if (manifest?.ready && manifest.mint && !guideShown.current) {
      guideShown.current = true;
      showGoLiveGuide();
    }
    return () => {
      toast.dismiss(GUIDE_TOAST);
    };
  }, [manifest?.ready, manifest?.mint]);
  useEffect(() => {
    const warn = (event: BeforeUnloadEvent) => {
      if (active || starting) {
        event.preventDefault();
        event.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [active, starting]);
  async function renderResponse(
    mode: "script" | "reply" | "recommendation",
    messages: ChatMessage[],
    signal: AbortSignal,
    context?: { sequence: number; recentScripts: string[] },
  ) {
    const { clip } = await api<{ clip: ShowClip }>(
      "/scripts",
      { id, mode, messages, brief: context ? `Continue this character's ongoing show, scene ${context.sequence}. No new introduction. Write a new 15-second moment, not a repeat of these earlier lines: ${context.recentScripts.join(" | ").slice(-750)}` : "" },
      signal,
    );
    if (manifest?.show.continuous && mode !== "reply") { clip.duration = 15; clip.chatPause = 0; }
    const job = await api<{ id: string }>("/videos", { id, clip }, signal);
    const deadline = Date.now() + 15 * 60000;
    while (!signal.aborted && Date.now() < deadline) {
      await delay(signal);
      const { renders } = await api<{
        renders: { id: string; status: string; video_url?: string }[];
      }>(`/videos?id=${encodeURIComponent(id)}`, undefined, signal);
      const result = renders.find((r) => r.id === job.id);
      if (result?.status === "ready" && result.video_url)
        return { id: clip.id, url: result.video_url, duration: clip.duration, script: clip.script };
      if (result?.status === "failed")
        throw new Error(
          "Video generation failed. This job will not be submitted twice.",
        );
    }
    throw new Error(
      "Render still pending. Check saved jobs; no duplicate was submitted.",
    );
  }
  async function start(goLive = false) {
    if (!manifest?.ready || sessionAbort.current || active || stopping.current)
      return;
    const controller = new AbortController();
    sessionAbort.current = controller;
    setStarting(true);
    setError("");
    try {
      if (goLive) {
        broadcastPreflight(manifest, endpoint, key);
        toast.dismiss(GUIDE_TOAST);
        toast.message("Going live. Keep this tab open, in front and unmuted.", {
          description: "After it connects, open your coin on pump.fun to confirm picture and sound.",
          duration: 12000,
        });
      }
      if (goLive && manifest.show.continuous) {
        setHealth("Checking the actual duration of the prepared video buffer…");
        const seconds = await measureMediaBuffer(manifest.clips, controller.signal);
        if (seconds < (manifest.show.bufferMinutes || 5) * 60)
          throw new Error(`Only ${Math.floor(seconds)} seconds of actual video are ready. Add scenes to reach the ${manifest.show.bufferMinutes || 5}-minute buffer.`);
      }
      if (!navigator.locks)
        throw new Error(
          "Use a browser with Web Locks to prevent duplicate publishers.",
        );
      // Each character holds its own tab lock. Other characters may run concurrently.
      await navigator.locks.request(
        `acp-show-${id}`,
        { ifAvailable: true },
        async (lock) => {
          if (!alive.current || controller.signal.aborted) return;
          if (!lock)
            throw new Error(
              "This character is already running in another tab.",
            );
          let release!: () => void;
          const held = new Promise<void>((resolve) => {
            release = resolve;
          });
          let disposed = false;
          const disposeSteps: (() => void)[] = [];
          const dispose = () => {
            if (disposed) return;
            disposed = true;
            for (const step of disposeSteps.reverse()) {
              try {
                step();
              } catch {
                /* Continue releasing the remaining resources. */
              }
            }
            stream.current = null;
            if (sessionAbort.current === controller)
              sessionAbort.current = null;
            controller.abort();
            releaseCredits();
            if (cleanup.current === dispose) cleanup.current = null;
            release();
          };
          cleanup.current = dispose;
          // A media element can only be attached to one Web Audio source. Create a fresh one on every start.
          let element = document.createElement("video"), spare = document.createElement("video");
          const surface = canvas.current!,
            ctx = surface.getContext("2d")!;
          element.crossOrigin = "anonymous";
          element.playsInline = true;
          element.preload = "auto";
          spare.crossOrigin = "anonymous"; spare.playsInline = true; spare.preload = "auto";
          surface.width = layout === "portrait" ? 720 : 1280;
          surface.height = layout === "portrait" ? 1280 : 720;
          const audio = new AudioContext();
          disposeSteps.push(() => {
            element.pause();
            element.removeAttribute("src");
            element.load();
            spare.pause(); spare.removeAttribute("src"); spare.load();
            void audio.close();
          });
          await audio.resume();
          if (disposed) return;
          const audioSource = audio.createMediaElementSource(element), spareAudio = audio.createMediaElementSource(spare),
            output = audio.createMediaStreamDestination();
          audioSource.connect(output);
          audioSource.connect(audio.destination);
          spareAudio.connect(output); spareAudio.connect(audio.destination);
          disposeSteps.push(() => audioSource.disconnect());
          disposeSteps.push(() => spareAudio.disconnect());
          ctx.fillStyle = "#143f32";
          ctx.fillRect(0, 0, surface.width, surface.height);
          ctx.fillStyle = "#f6f1e7";
          ctx.font = "32px sans-serif";
          ctx.fillText("ACP · Preparing the show", 40, 70);
          let drawError = false;
          const draw = setInterval(() => {
            if (element.readyState >= 2) {
              try {
                // Fill the backdrop, then contain the clip so portraits and gestures are never cropped.
                ctx.fillStyle = "#143f32";
                ctx.fillRect(0, 0, surface.width, surface.height);
                ctx.save();
                ctx.filter = "blur(26px) brightness(.5)";
                ctx.drawImage(
                  element,
                  -30,
                  -30,
                  surface.width + 60,
                  surface.height + 60,
                );
                ctx.restore();
                const scale = Math.min(
                  surface.width / element.videoWidth,
                  surface.height / element.videoHeight,
                );
                const w = element.videoWidth * scale,
                  h = element.videoHeight * scale;
                ctx.drawImage(
                  element,
                  (surface.width - w) / 2,
                  (surface.height - h) / 2,
                  w,
                  h,
                );
                ctx.fillStyle = "rgba(0,0,0,.48)";
                ctx.fillRect(18, 18, 430, 34);
                ctx.fillStyle = "white";
                ctx.font = "18px sans-serif";
                ctx.fillText(runner.current instanceof ContinuousShowRunner && runner.current.replaying ? "ACP · Previously generated scene · Replay" : "ACP · AI-generated character", 28, 41);
              } catch {
                if (!drawError) {
                  drawError = true;
                  setError(
                    "Video origin does not allow canvas streaming. Check the media provider’s CORS configuration.",
                  );
                }
              }
            }
          }, 1000 / 24);
          disposeSteps.push(() => clearInterval(draw));
          const captured = surface.captureStream(24);
          disposeSteps.push(() =>
            captured.getTracks().forEach((track) => track.stop()),
          );
          output.stream
            .getAudioTracks()
            .forEach((track) => captured.addTrack(track));
          stream.current = captured;
          const play = async (clip: RenderedClip, signal: AbortSignal) => {
            const candidate = spare;
            if (candidate.src !== clip.url) { candidate.src = clip.url; candidate.load(); }
            if (candidate.readyState < 3) await new Promise<void>((resolve, reject) => {
              const clear = () => { clearTimeout(timeout); candidate.removeEventListener("canplay", ready); candidate.removeEventListener("error", failed); signal.removeEventListener("abort", cancelled); };
              const ready = () => { clear(); resolve(); };
              const failed = () => { clear(); reject(new Error("Next clip could not be buffered. Trying the next scene.")); };
              const cancelled = () => { clear(); reject(new Error("Stopped.")); };
              const timeout = setTimeout(failed, 20000);
              candidate.addEventListener("canplay", ready, { once: true }); candidate.addEventListener("error", failed, { once: true }); signal.addEventListener("abort", cancelled, { once: true });
              if (signal.aborted) cancelled();
            });
            if (signal.aborted) throw new Error("Stopped.");
            element.pause(); spare = element; element = candidate; element.currentTime = 0;
            const playing = element;
            const next = runner.current instanceof ContinuousShowRunner ? runner.current.nextClip : null;
            if (next && spare.src !== next.url) { spare.src = next.url; spare.load(); }
            return new Promise<void>((resolve, reject) => {
              let lastTime = -1,
                progressed = Date.now();
              const watchdog = setInterval(() => {
                if (playing.currentTime !== lastTime) {
                  lastTime = playing.currentTime;
                  progressed = Date.now();
                } else if (Date.now() - progressed > 20000) failed();
              }, 1000);
              const clear = () => {
                clearInterval(watchdog);
                playing.removeEventListener("ended", ended);
                playing.removeEventListener("error", failed);
                signal.removeEventListener("abort", cancelled);
              };
              const ended = () => {
                clear();
                resolve();
              };
              const failed = () => {
                clear();
                reject(
                  new Error(
                    "Video playback failed. Check the render before restarting.",
                  ),
                );
              };
              const cancelled = () => {
                clear();
                playing.pause();
                reject(new Error("Stopped."));
              };
              playing.addEventListener("ended", ended, { once: true });
              playing.addEventListener("error", failed, { once: true });
              signal.addEventListener("abort", cancelled, { once: true });
              if (signal.aborted) {
                cancelled();
                return;
              }
              void playing.play().catch(failed);
            });
          };
          if (goLive) {
            setPublishing(true);
            setHealth("Connecting to pump.fun…");
            await publisher.current.start(
              captured,
              endpoint.trim(),
              key.trim(),
              controller.signal,
            );
            if (disposed || controller.signal.aborted) return;
            await activateCredits(controller);
            if (disposed || controller.signal.aborted) { releaseCredits(); return; }
            setConnected(true);
            setPublishing(false);
            setKey("");
            setHealth(
              "Stream connection accepted. Checking video and audio output…",
            );
          }
          const Runner = manifest.show.continuous ? ContinuousShowRunner : ShowRunner;
          const playbackPlan = manifest.creditsRequired ? {...manifest.show, maxGenerations: Math.max(manifest.show.maxGenerations, Math.ceil((credits?.videoSeconds || 0)/3))} : manifest.show;
          const current = new Runner(manifest.mint || id, playbackPlan, {
            play,
            reply: (message, signal) =>
              renderResponse("script", [], signal),
            generate: (messages, signal, context) =>
              renderResponse("script", [], signal, context),
          });
          current.start(manifest.clips);
          disposeSteps.push(() => current.stop());
          runner.current = current;
          const advance = () => {
            if (creditSession.current && creditDeadline.current <= Date.now()) {
              // A burn in another tab may have extended this session since the last poll.
              if (!checkingCreditExpiry.current) {
                checkingCreditExpiry.current=true;
                const sessionId=creditSession.current;
                void api<StreamCreditState>(`/credits?id=${encodeURIComponent(id)}`).then(value=>{
                  if (disposed || creditSession.current!==sessionId) return;
                  updateCredits(value);
                  if (value.sessionId!==sessionId || value.endsAt<=value.serverNow) {
                    void stop();setError("Stream time ended. Purchase more time to start another session.");
                  }
                }).catch(()=>{
                  if (!disposed && creditSession.current===sessionId) {void stop();setError("Could not verify remaining stream time. Check your saved credits before restarting.");}
                }).finally(()=>{checkingCreditExpiry.current=false;});
              }
              return;
            }
            const wasBusy = current.busy;
            void current.tick().then(() => {
              if (disposed) return;
              setPhase(current instanceof ContinuousShowRunner ? `${current.replaying ? "replaying" : "playing"} · ${current.buffered} queued · ${current.rendering} rendering · ${current.submitted}/${playbackPlan.maxGenerations} new renders used${current.generationPaused ? " · generation paused after an error" : ""}` : current.state.phase);
              if (current.error) setError(current.error);
              if (current.state.phase === "stopped") {
                dispose();
                void publisher.current.stop();
                setActive(false);
                setConnected(false);
                setHealth("Show stopped. Broadcast disconnected.");
              }
              if (!wasBusy && current instanceof ContinuousShowRunner && !current.busy && !disposed) setTimeout(() => { if (!disposed) advance(); }, 0);
            });
          };
          const timer = setInterval(advance, 500);
          disposeSteps.push(() => clearInterval(timer));
          const stats = setInterval(() => {
            void publisher.current
              .health()
              .then((h) => {
                if (disposed) return;
                setHealth(
                  `${h.state} · ${Math.round(h.kbps)} kbps · ${h.advancingFrames ? "video frames advancing" : "waiting for video frames"}. Check public playback below.`,
                );
                if (["failed", "disconnected", "closed"].includes(h.state)) {
                  setConnected(false);
                  setError(
                    "The stream connection was interrupted. Stop this show before reconnecting with the coin’s stream credentials.",
                  );
                }
              })
              .catch(() => {
                if (!disposed)
                  setError("Unable to read stream transport status.");
              });
          }, 5000);
          disposeSteps.push(() => clearInterval(stats));
          setActive(true);
          setStarting(false);
          await held;
        },
      );
    } catch (e) {
      const cancelled = controller.signal.aborted;
      if (sessionAbort.current === controller) {
        cleanup.current?.();
        sessionAbort.current = null;
        await publisher.current.stop();
      }
      if (!sessionAbort.current || sessionAbort.current === controller) {
        if (!cancelled)
          setError(e instanceof Error ? e.message : "Studio unavailable.");
        setActive(false);
        setConnected(false);
      }
    } finally {
      if (!sessionAbort.current || sessionAbort.current === controller) {
        setStarting(false);
        setPublishing(false);
        sessionAbort.current = null;
      }
    }
  }
  async function publish() {
    if (
      !stream.current ||
      !manifest?.mint ||
      publishing ||
      connected ||
      stopping.current
    )
      return;
    const expectedSession = sessionAbort.current;
    setPublishing(true);
    setError("");
    try {
      broadcastPreflight(manifest, endpoint, key);
      if (manifest.show.continuous) {
        if (!expectedSession) throw new Error("Start the show before publishing.");
        setHealth("Checking the actual duration of the prepared video buffer…");
        const seconds = await measureMediaBuffer(manifest.clips, expectedSession.signal);
        if (seconds < (manifest.show.bufferMinutes || 5) * 60)
          throw new Error(`Only ${Math.floor(seconds)} seconds of actual video are ready. Prepare the full buffer before publishing.`);
      }
      await publisher.current.start(
        stream.current,
        endpoint.trim(),
        key.trim(),
        sessionAbort.current?.signal,
      );
      if (!stream.current || sessionAbort.current?.signal.aborted) return;
      await activateCredits(expectedSession);
      if (sessionAbort.current !== expectedSession || expectedSession?.signal.aborted) { releaseCredits(); return; }
      setConnected(true);
      setKey("");
      setHealth(
        "WHIP accepted. Waiting for advancing output; public playback unverified.",
      );
    } catch (e) {
      if (
        sessionAbort.current === expectedSession &&
        !expectedSession?.signal.aborted
      )
        { releaseCredits(); await publisher.current.stop(); setError(e instanceof Error ? e.message : "Publishing failed."); }
    } finally {
      setPublishing(false);
    }
  }
  async function stop() {
    stopping.current = true;
    sessionAbort.current?.abort();
    cleanup.current?.();
    releaseCredits();
    await publisher.current.stop();
    sessionAbort.current = null;
    setKey("");
    setStarting(false);
    setPublishing(false);
    setConnected(false);
    setActive(false);
    setPhase("stopped");
    setHealth("Not publishing");
    stopping.current = false;
  }
  const canPublish =
    !!manifest?.ready &&
    (!manifest.creditsRequired || !!credits && (credits.streamSeconds>0 || credits.endsAt>credits.serverNow)) &&
    !!manifest?.mint &&
    (!manifest.show.continuous || preparedSeconds(manifest.show) >= (manifest.show.bufferMinutes || 5) * 60) &&
    !!endpoint.trim() &&
    !!key.trim() &&
    !starting &&
    !publishing &&
    !connected;
  return (
    <main className="lp acp-pages">
      <Toaster position="top-center" theme="light" />
      <AcpNav />
      <div className="acp-live-shell">
        <StreamCredits id={id} onState={updateCredits} />
        <div className="acp-live-heading">
          <div>
            <span className="lp-kicker">YOUR CHARACTER / BROADCAST STUDIO</span>
            <h1>
              {manifest?.name || "Character"}
              <em> on air.</em>
            </h1>
            <p>Play your scripts. Generate the next scene from your character’s creative direction.</p>
          </div>
          <a href={`/create/${id}/show`} className="lp-text-link">
            <ArrowLeft size={14} aria-hidden="true" /> Back to creation
          </a>
        </div>
        <div className="acp-live-grid">
          <div className="acp-program">
            <div className="acp-program-label">
              <span>PROGRAM OUTPUT</span>
              <span>
                {connected ? "CONNECTED" : active ? "REHEARSAL" : "OFF AIR"}
              </span>
            </div>
            <div className="acp-program-screen">
              <canvas
                ref={canvas}
                width={720}
                height={1280}
                style={{
                  aspectRatio: layout === "portrait" ? "9 / 16" : "16 / 9",
                }}
                aria-label="Character program output"
              />
              {!active && !starting && (
                <div className="acp-program-empty">
                  <Video size={42} strokeWidth={1.4} aria-hidden="true" />
                  <strong>Your show starts here.</strong>
                  <p>
                    Prepare the scenes, connect your coin’s stream, then go
                    live.
                  </p>
                </div>
              )}
            </div>
            <div className="acp-program-status" role="status">
              <span>Show: {phase}</span>
            </div>
            <p className="acp-stream-health">{health}</p>
            {manifest?.show.continuous && <p className="lp-field-note">Continuous mode · no shutdown timer. New renders use the saved generation limit. If generation falls behind, prepared clips replay with a visible label.</p>}
          </div>
          <section className="acp-stream-setup">
            <span className="lp-kicker">CONNECT YOUR PUMP.FUN STREAM</span>
            <h2>
              Ready when <em>you are.</em>
            </h2>
            {!viewer.wallet ? (
              <div className="acp-live-notice">
                <p>
                  Connect the wallet that owns this character to load its token
                  and prepared videos.
                </p>
                <button className="lp-primary" onClick={connect}>
                  Connect wallet
                </button>
              </div>
            ) : (
              <div className="acp-live-readiness">
                <span>
                  {loading
                    ? "Loading your show…"
                    : manifest?.ready
                      ? `${manifest.clips.length} scenes ready${manifest.show.continuous ? ` · ${preparedSeconds(manifest.show)} / ${(manifest.show.bufferMinutes || 5) * 60} planned buffer seconds` : ""}`
                      : "Generate the current scenes before going live."}
                </span>
                <button
                  className="lp-text-link"
                  disabled={active || starting || loading}
                  onClick={() => setRevision((n) => n + 1)}
                >
                  Refresh show ↻
                </button>
              </div>
            )}
            <label>
              Token linked to this character
              <input
                value={manifest?.mint || "No confirmed coin linked yet"}
                readOnly
                aria-label="Linked token contract"
              />
            </label>
            {manifest?.mint && (
              <a
                className="lp-text-link"
                href={`https://pump.fun/coin/${manifest.mint}`}
                target="_blank"
                rel="noopener noreferrer"
              >
                Open this coin on pump.fun <ArrowUpRight size={14} aria-hidden="true" />
              </a>
            )}
            <label>
              Output format
              <select
                value={layout}
                disabled={active || starting}
                onChange={(e) => setLayout(e.target.value)}
              >
                <option value="portrait">Portrait · 9:16</option>
                <option value="landscape">Landscape · 16:9</option>
              </select>
            </label>
            <label>
              Stream URL (WHIP)
              <input
                type="url"
                value={endpoint}
                onChange={(e) => setEndpoint(e.target.value)}
                placeholder="https://pump-….whip.livekit.cloud/w"
                autoComplete="off"
                spellCheck={false}
                disabled={connected || starting || publishing}
              />
            </label>
            <label>
              Stream key
              <input
                type="password"
                value={key}
                onChange={(e) => setKey(e.target.value)}
                placeholder="Paste this coin’s stream key"
                autoComplete="off"
                spellCheck={false}
                disabled={connected || starting || publishing}
              />
            </label>
            <button type="button" className="lp-text-link" onClick={showGoLiveGuide}>
              How to go live ↗
            </button>
            <p className="acp-live-help">
              Copy the stream credentials from this coin’s pump.fun streaming
              settings. The supplied key controls the destination. Keys stay in this tab’s memory.
            </p>
            {error && (
              <p role="alert" className="acp-live-error">
                {error}
              </p>
            )}
            <button
              className="lp-primary acp-go-live"
              disabled={!canPublish}
              onClick={() => void (active ? publish() : start(true))}
            >
              {starting || publishing
                ? "Connecting…"
                : connected
                  ? "Stream connected"
                  : <>Go Live <ArrowUpRight size={14} aria-hidden="true" /></>}
            </button>
            <div className="acp-live-actions">
              <button
                className="lp-secondary"
                disabled={!manifest?.ready || active || starting}
                onClick={() => void start(false)}
              >
                Preview show
              </button>
              <button
                className="lp-secondary"
                disabled={!active && !starting && !publishing}
                onClick={() => void stop()}
              >
                Stop stream
              </button>
            </div>
            <div className="acp-live-notice">
              <strong>Keep this studio tab open.</strong>
              <p>
                This browser sends the video and audio directly to Pump. Closing
                the tab or letting the device sleep interrupts the stream. Each
                character runs in its own tab.
              </p>
            </div>
            <p className="acp-live-help">
              Go Live starts the prepared videos for this token.
              Generating new scenes requires connected
              generation services. After connecting, open the coin to verify
              public playback.
            </p>
          </section>
        </div>
      </div>
      <AcpFooter />
    </main>
  );
}
