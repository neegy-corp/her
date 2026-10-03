import type { RenderedClip } from "./show-runner";

/** Check real media lengths, not AI-requested durations, before promising a fresh buffer. */
export async function measureMediaBuffer(clips: RenderedClip[], signal: AbortSignal) {
  let cursor = 0;
  const seconds: number[] = [];
  const measure = (clip: RenderedClip) => new Promise<number>((resolve, reject) => {
    const video = document.createElement("video");
    video.crossOrigin = "anonymous"; video.preload = "metadata";
    const clear = () => {
      clearTimeout(timer); signal.removeEventListener("abort", cancel);
      video.removeEventListener("loadedmetadata", loaded); video.removeEventListener("error", failed);
      video.removeAttribute("src"); video.load();
    };
    const failed = () => { clear(); reject(new Error("A prepared video could not be checked. Broadcast has not started.")); };
    const cancel = () => { clear(); reject(new Error("Stopped.")); };
    const loaded = () => { const duration = video.duration; clear(); if (!Number.isFinite(duration) || duration <= 0) reject(new Error("Prepared video has an invalid duration.")); else resolve(duration); };
    const timer = setTimeout(failed, 30000);
    video.addEventListener("loadedmetadata", loaded, { once: true }); video.addEventListener("error", failed, { once: true });
    signal.addEventListener("abort", cancel, { once: true });
    if (signal.aborted) return cancel();
    video.src = clip.url; video.load();
  });
  await Promise.all(Array.from({ length: Math.min(4, clips.length) }, async () => {
    while (cursor < clips.length && !signal.aborted) { const index = cursor++; seconds[index] = await measure(clips[index]); }
  }));
  if (signal.aborted) throw new Error("Stopped.");
  return seconds.reduce((total, duration) => total + duration, 0);
}
