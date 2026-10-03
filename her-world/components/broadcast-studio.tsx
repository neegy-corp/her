"use client";
import { useEffect, useRef, useState } from "react";
import { ShowRunner, type RenderedClip } from "@/lib/show-runner";
import { WhipPublisher } from "@/lib/whip-publisher";
import { openPumpChat } from "@/lib/pump-chat";
import type { ChatMessage, ShowClip, ShowPlan } from "@/lib/show";
import "./launchpad.css";
type Manifest = {
  name: string;
  mint: string | null;
  ready: boolean;
  show: ShowPlan;
  clips: RenderedClip[];
};
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
  const canvas = useRef<HTMLCanvasElement>(null);
  const runner = useRef<ShowRunner | null>(null),
    publisher = useRef(new WhipPublisher());
  const cleanup = useRef<(() => void) | null>(null),
    stream = useRef<MediaStream | null>(null);
  const alive = useRef(true);
  const [manifest, setManifest] = useState<Manifest | null>(null),
    [error, setError] = useState("");
  const [active, setActive] = useState(false),
    [starting, setStarting] = useState(false),
    [phase, setPhase] = useState("stopped"),
    [chat, setChat] = useState("not connected");
  const [endpoint, setEndpoint] = useState(""),
    [key, setKey] = useState(""),
    [publishing, setPublishing] = useState(false),
    [health, setHealth] = useState("Not publishing");
  useEffect(() => {
    alive.current = true;
    const controller = new AbortController();
    api<Manifest>(
      `/studio?id=${encodeURIComponent(id)}`,
      undefined,
      controller.signal,
    )
      .then(setManifest)
      .catch((e) => {
        if (!controller.signal.aborted) setError(e.message);
      });
    return () => {
      alive.current = false;
      controller.abort();
      cleanup.current?.();
      void publisher.current.stop();
    };
  }, [id]);
  async function renderResponse(
    mode: "reply" | "recommendation",
    messages: ChatMessage[],
    signal: AbortSignal,
  ) {
    const { clip } = await api<{ clip: ShowClip }>(
      "/scripts",
      { id, mode, messages },
      signal,
    );
    const job = await api<{ id: string }>("/videos", { id, clip }, signal);
    const deadline = Date.now() + 15 * 60000;
    while (!signal.aborted && Date.now() < deadline) {
      await delay(signal);
      const { renders } = await api<{
        renders: { id: string; status: string; video_url?: string }[];
      }>(`/videos?id=${encodeURIComponent(id)}`, undefined, signal);
      const result = renders.find((r) => r.id === job.id);
      if (result?.status === "ready" && result.video_url)
        return { id: clip.id, url: result.video_url };
      if (result?.status === "failed")
        throw new Error(
          "Video generation failed. This job will not be submitted twice.",
        );
    }
    throw new Error(
      "Render still pending. Check saved jobs; no duplicate was submitted.",
    );
  }
  async function start() {
    if (!manifest?.ready || starting || active) return;
    setStarting(true);
    setError("");
    try {
      if (!navigator.locks)
        throw new Error(
          "Use a browser with Web Locks to prevent duplicate publishers.",
        );
      // Each character holds its own tab lock. Other characters may run concurrently.
      await navigator.locks.request(
        `acp-show-${id}`,
        { ifAvailable: true },
        async (lock) => {
          if (!alive.current) return;
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
            if (cleanup.current === dispose) cleanup.current = null;
            release();
          };
          cleanup.current = dispose;
          // A media element can only be attached to one Web Audio source. Create a fresh one on every start.
          const element = document.createElement("video"),
            surface = canvas.current!,
            ctx = surface.getContext("2d")!;
          element.crossOrigin = "anonymous";
          element.playsInline = true;
          const audio = new AudioContext();
          disposeSteps.push(() => {
            element.pause();
            element.removeAttribute("src");
            element.load();
            void audio.close();
          });
          await audio.resume();
          if (disposed) return;
          const audioSource = audio.createMediaElementSource(element),
            output = audio.createMediaStreamDestination();
          audioSource.connect(output);
          audioSource.connect(audio.destination);
          disposeSteps.push(() => audioSource.disconnect());
          ctx.fillStyle = "#143f32";
          ctx.fillRect(0, 0, surface.width, surface.height);
          ctx.fillStyle = "#f6f1e7";
          ctx.font = "32px sans-serif";
          ctx.fillText("ACP · Preparing the show", 40, 70);
          let drawError = false;
          const draw = setInterval(() => {
            if (element.readyState >= 2) {
              try {
                // Cover the output with the current video; retain the last frame during generation.
                const scale = Math.max(
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
                ctx.fillRect(18, 18, 260, 34);
                ctx.fillStyle = "white";
                ctx.font = "18px sans-serif";
                ctx.fillText("ACP · AI-generated character", 28, 41);
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
          const play = (clip: RenderedClip, signal: AbortSignal) =>
            new Promise<void>((resolve, reject) => {
              let lastTime = -1,
                progressed = Date.now();
              const watchdog = setInterval(() => {
                if (element.currentTime !== lastTime) {
                  lastTime = element.currentTime;
                  progressed = Date.now();
                } else if (Date.now() - progressed > 20000) failed();
              }, 1000);
              const clear = () => {
                clearInterval(watchdog);
                element.removeEventListener("ended", ended);
                element.removeEventListener("error", failed);
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
                element.pause();
                reject(new Error("Stopped."));
              };
              element.addEventListener("ended", ended, { once: true });
              element.addEventListener("error", failed, { once: true });
              signal.addEventListener("abort", cancelled, { once: true });
              if (signal.aborted) {
                cancelled();
                return;
              }
              element.src = clip.url;
              element.load();
              void element.play().catch(failed);
            });
          const current = new ShowRunner(manifest.mint || id, manifest.show, {
            play,
            reply: (message, signal) =>
              renderResponse("reply", [message], signal),
            generate: (messages, signal) =>
              renderResponse("recommendation", messages, signal),
          });
          current.start(manifest.clips);
          disposeSteps.push(() => current.stop());
          runner.current = current;
          const stopChat = manifest.mint
            ? openPumpChat(
                manifest.mint,
                (m) => current.receive(manifest.mint!, m),
                setChat,
              )
            : () => undefined;
          disposeSteps.push(stopChat);
          if (!manifest.mint) setChat("No deployed coin; rehearsal only");
          const timer = setInterval(() => {
            void current.tick().then(() => {
              setPhase(current.state.phase);
              if (current.error) setError(current.error);
            });
          }, 500);
          disposeSteps.push(() => clearInterval(timer));
          const stats = setInterval(() => {
            void publisher.current
              .health()
              .then((h) =>
                setHealth(
                  `${h.state} · ${Math.round(h.kbps)} kbps · ${h.advancingFrames ? "frames advancing" : "no fresh frame proof"}. Public playback unverified.`,
                ),
              );
          }, 5000);
          disposeSteps.push(() => clearInterval(stats));
          setActive(true);
          setStarting(false);
          await held;
        },
      );
    } catch (e) {
      cleanup.current?.();
      setError(e instanceof Error ? e.message : "Studio unavailable.");
    } finally {
      setStarting(false);
    }
  }
  async function publish() {
    if (!stream.current || !manifest?.mint) return;
    setPublishing(true);
    setError("");
    try {
      await publisher.current.start(stream.current, endpoint, key);
      setKey("");
      setHealth(
        "WHIP accepted. Waiting for advancing output; public playback unverified.",
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Publishing failed.");
    } finally {
      setPublishing(false);
    }
  }
  async function stop() {
    cleanup.current?.();
    await publisher.current.stop();
    setActive(false);
    setPhase("stopped");
    setHealth("Not publishing");
  }
  return (
    <main className="lp lp-broadcast">
      <a href="/">← ACP launchpad</a>
      <h1>{manifest?.name || "Character"} studio</h1>
      <p>
        One tab per character. Keep this tab open. Cloud hosting is required for
        unattended broadcasts.
      </p>
      <canvas
        ref={canvas}
        width={1280}
        height={720}
        aria-label="Character program output"
      />
      <p role="status">
        Show: {phase} · Chat: {chat}
      </p>
      <p>{health}</p>
      {error && <p role="alert">{error}</p>}
      <button
        className="lp-primary"
        disabled={!manifest?.ready || active || starting}
        onClick={() => void start()}
      >
        {starting ? "Starting…" : "Start rehearsal"}
      </button>
      <button
        className="lp-secondary"
        disabled={!active}
        onClick={() => void stop()}
      >
        Stop show and broadcast
      </button>
      {manifest && !manifest.ready && (
        <p>
          Render every current scene first, then refresh this page. Old renders
          from different scripts or reference images are excluded.
        </p>
      )}
      <section>
        <h2>Publish this coin’s show</h2>
        <p>
          {manifest?.mint
            ? `Coin: ${manifest.mint}`
            : "Deploy the coin with your wallet before publishing."}
        </p>
        <label>
          WHIP endpoint
          <input
            value={endpoint}
            onChange={(e) => setEndpoint(e.target.value)}
            placeholder="https://pump-….whip.livekit.cloud/w"
            autoComplete="off"
          />
        </label>
        <label>
          Stream key
          <input
            type="password"
            value={key}
            onChange={(e) => setKey(e.target.value)}
            autoComplete="off"
          />
        </label>
        <p>
          Use this coin’s stream credentials. They stay in this tab’s memory and
          are sent only to its Pump WHIP endpoint.
        </p>
        <button
          className="lp-primary"
          disabled={!active || !manifest?.mint || !key || publishing}
          onClick={() => void publish()}
        >
          Publish to pump.fun
        </button>
        {manifest?.mint && (
          <a
            href={`https://pump.fun/coin/${manifest.mint}`}
            target="_blank"
            rel="noreferrer"
          >
            Check public playback ↗
          </a>
        )}
      </section>
    </main>
  );
}
